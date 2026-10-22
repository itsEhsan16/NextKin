import { describe, expect, it, vi } from 'vitest';
import { ApiError, createAuthClient, type TokenStore } from '../src/auth';

/** The phone-safe auth client (P4-10) against a scripted fetch. */

const user = {
  id: 'u1',
  email: 'a@b.test',
  firstName: 'A',
  lastName: 'B',
  emailVerified: true,
  role: 'user',
};
const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const unauthenticated = () =>
  json(401, {
    error: { code: 'UNAUTHENTICATED', message: 'Sign in again.', details: null, request_id: 'r1' },
  });

type Tokens = Awaited<ReturnType<TokenStore['get']>>;

function memoryTokens(initial: { accessToken: string; refreshToken: string } | null = null) {
  const store: TokenStore & { value: Tokens } = {
    value: initial ? { ...initial, expiresIn: 3600 } : null,
    get: async () => store.value,
    set: async (tokens) => {
      store.value = tokens;
    },
  };
  return store;
}

describe('mobile', () => {
  it('login stores the tokens and later requests carry the bearer token', async () => {
    const tokens = memoryTokens();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        json(200, { user, tokens: { accessToken: 'at1', refreshToken: 'rt1', expiresIn: 3600 } }),
      )
      .mockResolvedValueOnce(json(200, { user }));
    const client = createAuthClient({
      baseUrl: 'http://lan:3000/',
      client: 'mobile',
      tokens,
      fetch,
      clientVersion: '1.2.0',
    });
    await expect(client.login('a@b.test', 'pw')).resolves.toMatchObject({ id: 'u1' });
    expect(tokens.value).toMatchObject({ accessToken: 'at1' });
    await client.session();
    const [url, init] = fetch.mock.calls[1]!;
    expect(url).toBe('http://lan:3000/api/v1/auth/session');
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer at1',
      'x-client-version': '1.2.0',
    });
    expect(init?.credentials).toBe('omit');
  });

  it('a 401 refreshes once and retries with the new token', async () => {
    const tokens = memoryTokens({ accessToken: 'old', refreshToken: 'rt-old-0123456789' });
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(unauthenticated())
      .mockResolvedValueOnce(
        json(200, { accessToken: 'new', refreshToken: 'rt-new-0123456789', expiresIn: 3600 }),
      )
      .mockResolvedValueOnce(json(200, { ok: true }));
    const client = createAuthClient({ baseUrl: '', client: 'mobile', tokens, fetch });
    await expect(client.request('/me/settings')).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls[2]![1]?.headers).toMatchObject({ authorization: 'Bearer new' });
  });

  it('parallel 401s share one refresh (a second refresh would trip reuse detection)', async () => {
    const tokens = memoryTokens({ accessToken: 'old', refreshToken: 'rt-old-0123456789' });
    let refreshes = 0;
    const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
      if (String(url).endsWith('/auth/token/refresh')) {
        refreshes++;
        await new Promise((r) => setTimeout(r, 5));
        return json(200, {
          accessToken: 'new',
          refreshToken: 'rt-new-0123456789',
          expiresIn: 3600,
        });
      }
      const auth = (init?.headers as Record<string, string>).authorization;
      return auth === 'Bearer new' ? json(200, { ok: true }) : unauthenticated();
    });
    const client = createAuthClient({ baseUrl: '', client: 'mobile', tokens, fetch });
    await Promise.all([client.request('/a'), client.request('/b'), client.request('/c')]);
    expect(refreshes).toBe(1);
  });

  it('a failed refresh signs out: tokens cleared, callback fired, the 401 surfaces', async () => {
    const tokens = memoryTokens({ accessToken: 'old', refreshToken: 'rt-old-0123456789' });
    const onSignedOut = vi.fn();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(unauthenticated())
      .mockResolvedValueOnce(unauthenticated());
    const client = createAuthClient({ baseUrl: '', client: 'mobile', tokens, fetch, onSignedOut });
    await expect(client.request('/me/settings')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
      requestId: 'r1',
    });
    expect(tokens.value).toBeNull();
    expect(onSignedOut).toHaveBeenCalledOnce();
  });

  it('a wrong password at login is an error, not a sign-out', async () => {
    const onSignedOut = vi.fn();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(unauthenticated());
    const client = createAuthClient({
      baseUrl: '',
      client: 'mobile',
      tokens: memoryTokens(),
      fetch,
      onSignedOut,
    });
    await expect(client.login('a@b.test', 'wrong')).rejects.toBeInstanceOf(ApiError);
    expect(onSignedOut).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('logout sends the bearer token, so the server can end that session', async () => {
    const tokens = memoryTokens({ accessToken: 'at-live', refreshToken: 'rt-0123456789abcdef' });
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    await createAuthClient({ baseUrl: '', client: 'mobile', tokens, fetch }).logout();
    expect(fetch.mock.calls[0]![1]?.headers).toMatchObject({ authorization: 'Bearer at-live' });
    expect(tokens.value).toBeNull();
  });

  it('logout clears tokens even when the network is down', async () => {
    const tokens = memoryTokens({ accessToken: 'at', refreshToken: 'rt-0123456789abcdef' });
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('offline'));
    await createAuthClient({ baseUrl: '', client: 'mobile', tokens, fetch }).logout();
    expect(tokens.value).toBeNull();
  });

  it('refuses to start without a token store', () => {
    expect(() => createAuthClient({ baseUrl: '', client: 'mobile' })).toThrow(/TokenStore/);
  });
});

describe('web', () => {
  it('sends the cookie, stores nothing, and never sends a bearer token', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(200, { user }));
    const client = createAuthClient({ baseUrl: '', client: 'web', fetch });
    await client.login('a@b.test', 'pw');
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('/api/v1/auth/login');
    expect(JSON.parse(String(init?.body))).toMatchObject({ client: 'web' });
    expect(init?.credentials).toBe('include');
    expect(init?.headers).not.toHaveProperty('authorization');
  });

  it('builds the provider sign-in URL', () => {
    const client = createAuthClient({
      baseUrl: 'http://localhost:3000',
      client: 'web',
      fetch: vi.fn(),
    });
    expect(client.federatedUrl('google', '/jobs')).toBe(
      'http://localhost:3000/api/v1/auth/login/google?client=web&redirect=%2Fjobs',
    );
  });
});
