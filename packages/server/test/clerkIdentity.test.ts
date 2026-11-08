import { describe, expect, it, vi } from 'vitest';
import { azpAllowed, createClerkIdentityProvider, profileFromClerk, type ClerkApi, type ClerkUserLike } from '../src/auth/adapters/clerk/provider';
import { AuthError } from '../src/auth/ports/identity';
import { ConfigError, loadConfig } from '../src/config';

const user: ClerkUserLike = {
  id: 'user_2abc',
  firstName: 'Ada',
  lastName: 'Lovelace',
  primaryEmailAddressId: 'idn_2',
  emailAddresses: [
    { id: 'idn_1', emailAddress: 'old@example.com', verification: { status: 'unverified' } },
    { id: 'idn_2', emailAddress: 'ada@example.com', verification: { status: 'verified' } },
  ],
  externalAccounts: [{ provider: 'oauth_google', createdAt: Date.UTC(2026, 10, 1) }, { provider: 'oauth_github' }],
};

function fakeApi(overrides: Partial<ClerkApi> = {}): ClerkApi {
  return {
    verify: vi.fn(async () => ({ sub: user.id, sid: 'sess_9' })),
    getUser: vi.fn(async () => user),
    sessionActive: vi.fn(async () => true),
    revokeSession: vi.fn(async () => {}),
    activeSessionIds: vi.fn(async () => ['sess_1', 'sess_2']),
    deleteUser: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('Clerk identity adapter', () => {
  it('maps the primary email, its verification and the name', () => {
    expect(profileFromClerk(user)).toEqual({ sub: 'user_2abc', pool: 'users', email: 'ada@example.com', emailVerified: true, name: 'Ada Lovelace', groups: [] });
  });

  it('refuses an account without an email', () => {
    expect(() => profileFromClerk({ ...user, emailAddresses: [] })).toThrow(AuthError);
  });

  it('exchanges a session token for a profile keyed by the Clerk session', async () => {
    const result = await createClerkIdentityProvider(fakeApi()).exchange('token');
    expect(result.profile.sub).toBe('user_2abc');
    expect(result.tokens.sessionRef).toBe('sess_9');
    expect(result.tokens.accessToken).toBe('');
  });

  it('answers token_invalid for a bad token or one without a session', async () => {
    const bad = createClerkIdentityProvider(fakeApi({ verify: async () => Promise.reject(new Error('expired')) }));
    await expect(bad.exchange('token')).rejects.toMatchObject({ failure: 'token_invalid' });
    const noSid = createClerkIdentityProvider(fakeApi({ verify: async () => ({ sub: user.id }) }));
    await expect(noSid.exchange('token')).rejects.toMatchObject({ failure: 'token_invalid' });
  });

  it('refuses to revive a session that was signed out in Clerk', async () => {
    const idp = createClerkIdentityProvider(fakeApi({ sessionActive: async () => false }));
    await expect(idp.exchange('token')).rejects.toMatchObject({ failure: 'token_invalid' });
  });

  it('revokes in Clerk on logout and on sign-out everywhere', async () => {
    const api = fakeApi();
    const idp = createClerkIdentityProvider(api);
    await idp.revokeSession('sess_9');
    await idp.globalSignOut(user.id);
    expect(api.revokeSession).toHaveBeenCalledWith('sess_9');
    expect(api.revokeSession).toHaveBeenCalledWith('sess_1');
    expect(api.revokeSession).toHaveBeenCalledWith('sess_2');
  });

  it('treats an already-deleted Clerk user as deleted', async () => {
    const idp = createClerkIdentityProvider(fakeApi({ deleteUser: async () => Promise.reject(Object.assign(new Error('gone'), { status: 404 })) }));
    await expect(idp.deleteAccount(user.id)).resolves.toBeUndefined();
  });

  it('lists only the providers the port knows', async () => {
    const identities = await createClerkIdentityProvider(fakeApi()).listIdentities(user.id);
    expect(identities).toEqual([{ provider: 'google', linkedAt: '2026-11-01T00:00:00.000Z' }]);
  });

  it('refuses the flows Clerk owns in the browser', async () => {
    await expect(createClerkIdentityProvider(fakeApi()).signUp({ email: 'a@b.co', password: 'x' })).rejects.toBeInstanceOf(AuthError);
  });

  it('takes a native token with no azp, and a browser token only from our origins (§173)', () => {
    const ours = ['https://app.nextkin.ai'];
    expect(azpAllowed(undefined, ours)).toBe(true);
    expect(azpAllowed('https://app.nextkin.ai', ours)).toBe(true);
    expect(azpAllowed('https://evil.example', ours)).toBe(false);
    expect(azpAllowed(42, ours)).toBe(false);
  });
});

describe('Clerk configuration', () => {
  const base = {
    APP_ENV: 'local',
    DATABASE_URL: 'postgres://nextkin_app:pw@127.0.0.1:5432/nextkin',
    VALKEY_URL: 'redis://127.0.0.1:6379',
    CURSOR_SECRET: 'Zq3v9Kp2Wm8Xr4Ty7Ub1Nc6Hd5Fg0JsQe8Lw',
  };

  it('needs the secret key when chosen', () => {
    expect(() => loadConfig({ ...base, IDENTITY_ADAPTER: 'clerk' })).toThrow(ConfigError);
    expect(loadConfig({ ...base, IDENTITY_ADAPTER: 'clerk', CLERK_SECRET_KEY: 'sk_test_abc' }).IDENTITY_ADAPTER).toBe('clerk');
  });

  it('refuses a development key in production', () => {
    expect(() => loadConfig({ ...base, APP_ENV: 'production', IDENTITY_ADAPTER: 'clerk', CLERK_SECRET_KEY: 'sk_test_abc' })).toThrow(/Clerk development key/);
  });
});
