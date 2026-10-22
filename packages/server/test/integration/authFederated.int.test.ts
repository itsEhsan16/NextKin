import { randomUUID } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FakeClaims } from './fixtures/fakeIssuer';
import { address, call, cookieFrom, mobileLogin, ORIGIN, registered, startHarness, webLogin, withBearer, withCookie, type Harness } from './fixtures/authHarness';

/**
 * Google and Apple sign-in, the mobile hand-off and token refresh over HTTP
 * (ImBackendImplementationPlan P4-03, P4-06, P4-07). The fake issuers stand in for the providers;
 * the server's half — state, nonce, PKCE, linking, cookies, the hand-off — is all real.
 */
let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

const REDIRECT_URI = `${ORIGIN}/api/v1/auth/callback`;

/** Starts a sign-in and returns what the provider received, as the browser would carry it. */
async function start(provider: 'google' | 'apple', query = '') {
  const res = await call(h, `/auth/login/${provider}${query}`);
  expect(res.status).toBe(302);
  const to = new URL(res.headers.get('location')!);
  expect(to.searchParams.get('code_challenge_method')).toBe('S256');
  expect(to.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
  return { state: to.searchParams.get('state')!, nonce: to.searchParams.get('nonce')!, challenge: to.searchParams.get('code_challenge')! };
}

/** The provider "authenticates" the user and sends the browser back with a code. */
function providerCode(provider: 'google' | 'apple', login: { nonce: string; challenge: string }, claims: FakeClaims) {
  return (provider === 'google' ? h.google : h.apple).issueCode({ claims, nonce: login.nonce, codeChallenge: login.challenge, redirectUri: REDIRECT_URI });
}

describe('web federated sign-in', () => {
  it('Google: redirect out with PKCE, back with a code, a session cookie and a same-site redirect', async () => {
    const login = await start('google', '?redirect=/jobs');
    const code = providerCode('google', login, { sub: `g-${randomUUID()}`, email: address(), email_verified: true, name: 'Gale Google' });
    const res = await call(h, `/auth/callback?code=${code}&state=${login.state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/jobs`);
    const me = await call(h, '/auth/session', { headers: withCookie(cookieFrom(res)) });
    expect((await me.json()).user).toMatchObject({ firstName: 'Gale', lastName: 'Google', emailVerified: true });
  });

  it('an open redirect is not possible: foreign or protocol-relative targets fall back to /', async () => {
    for (const redirect of ['https://evil.example', '//evil.example', '/\\evil.example']) {
      const login = await start('google', `?redirect=${encodeURIComponent(redirect)}`);
      const code = providerCode('google', login, { sub: `g-${randomUUID()}`, email: address(), email_verified: true });
      const res = await call(h, `/auth/callback?code=${code}&state=${login.state}`);
      expect(res.headers.get('location')).toBe(`${ORIGIN}/`);
    }
  });

  it('a state is single use: replaying the callback is refused', async () => {
    const login = await start('google');
    const code = providerCode('google', login, { sub: `g-${randomUUID()}`, email: address(), email_verified: true });
    expect((await call(h, `/auth/callback?code=${code}&state=${login.state}`)).status).toBe(302);
    expect((await call(h, `/auth/callback?code=${code}&state=${login.state}`)).status).toBe(400);
    expect((await call(h, `/auth/callback?code=${code}&state=never-issued`)).status).toBe(400);
  });

  it('Apple posts the form; the name comes on the first authorization only and is kept', async () => {
    const sub = `a-${randomUUID()}`;
    const relay = `${randomUUID().slice(0, 8)}@privaterelay.appleid.com`;
    const post = async (user?: object) => {
      const login = await start('apple');
      const code = providerCode('apple', login, { sub, email: relay, email_verified: true });
      const form = new URLSearchParams({ code, state: login.state, ...(user ? { user: JSON.stringify(user) } : {}) });
      return h.app.request('/api/v1/auth/callback', { method: 'POST', body: form, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    };
    const first = await post({ name: { firstName: 'Arden', lastName: 'Apple' } });
    expect(first.status).toBe(302);
    const second = await post();
    const me = await call(h, '/auth/session', { headers: withCookie(cookieFrom(second)) });
    expect((await me.json()).user).toMatchObject({ firstName: 'Arden', lastName: 'Apple' });
  });

  it('linking: a password account and Google with the same verified email are one user', async () => {
    const to = await registered(h);
    const viaPassword = await call(h, '/auth/session', { headers: withCookie(await webLogin(h, to)) });
    const login = await start('google');
    const code = providerCode('google', login, { sub: `g-${randomUUID()}`, email: to, email_verified: true });
    const viaGoogle = await call(h, '/auth/session', { headers: withCookie(cookieFrom(await call(h, `/auth/callback?code=${code}&state=${login.state}`))) });
    expect((await viaGoogle.json()).user.id).toBe((await viaPassword.json()).user.id);
  });
});

describe('mobile federated sign-in (C-12 hand-off)', () => {
  it('redirects to the app with a one-time code that swaps for tokens exactly once', async () => {
    const login = await start('google', `?client=mobile&redirect=${encodeURIComponent('nextkin://auth/done')}`);
    const code = providerCode('google', login, { sub: `g-${randomUUID()}`, email: address(), email_verified: true });
    const res = await call(h, `/auth/callback?code=${code}&state=${login.state}`);
    const target = new URL(res.headers.get('location')!);
    expect(`${target.protocol}//${target.host}${target.pathname}`).toBe('nextkin://auth/done');
    expect(res.headers.get('location')).not.toMatch(/token/i);
    const handoff = target.searchParams.get('code')!;
    const swapped = await call(h, '/auth/token/exchange', { body: { code: handoff } });
    expect(swapped.status).toBe(200);
    const { tokens } = await swapped.json();
    expect((await call(h, '/auth/session', { headers: withBearer(tokens.accessToken) })).status).toBe(200);
    expect((await call(h, '/auth/token/exchange', { body: { code: handoff } })).status).toBe(401);
  });

  it('an app redirect outside the allowlist is refused before the provider is contacted', async () => {
    const res = await call(h, `/auth/login/google?client=mobile&redirect=${encodeURIComponent('https://evil.example/cb')}`);
    expect(res.status).toBe(400);
  });
});

describe('mobile tokens', () => {
  it('refresh rotates; replaying the old refresh token ends the session at once', async () => {
    const first = await mobileLogin(h, await registered(h));
    const rotated = await call(h, '/auth/token/refresh', { body: { refreshToken: first.refreshToken } });
    expect(rotated.status).toBe(200);
    const second = await rotated.json();
    expect((await call(h, '/auth/session', { headers: withBearer(second.accessToken) })).status).toBe(200);
    expect((await call(h, '/auth/token/refresh', { body: { refreshToken: first.refreshToken } })).status).toBe(401);
    // Theft signal: the unexpired access token from that session stops working immediately.
    expect((await call(h, '/auth/session', { headers: withBearer(second.accessToken) })).status).toBe(401);
    expect((await call(h, '/auth/token/refresh', { body: { refreshToken: second.refreshToken } })).status).toBe(401);
  });

  it('a token from another issuer, for another audience, or signed with another key is anonymous', async () => {
    const tokens = await mobileLogin(h, await registered(h));
    const real = await h.stack.identity.idp.verifyAccessToken(tokens.accessToken);
    const { privateKey } = await generateKeyPair('ES256');
    const forge = (issuer: string, audience: string) =>
      new SignJWT({ token_use: 'access', sid: real.sessionRef, client_id: 'nextkin-mobile' })
        .setProtectedHeader({ alg: 'ES256', kid: 'forged' })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(real.sub)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
    for (const token of [await forge('urn:nextkin:local-idp', 'nextkin-mobile'), await forge('https://evil.example', 'nextkin-mobile'), await forge('urn:nextkin:local-idp', 'someone-else')]) {
      expect((await call(h, '/auth/session', { headers: withBearer(token) })).status).toBe(401);
    }
    const [header, payload] = tokens.accessToken.split('.');
    const tampered = JSON.parse(Buffer.from(payload!, 'base64url').toString());
    tampered.sub = 'local|someone-else';
    const reSigned = `${header}.${Buffer.from(JSON.stringify(tampered)).toString('base64url')}.${tokens.accessToken.split('.')[2]}`;
    expect((await call(h, '/auth/session', { headers: withBearer(reSigned) })).status).toBe(401);
  });

  it('the JWKS endpoint publishes only public keys', async () => {
    const res = await call(h, '/local-idp/.well-known/jwks.json');
    const { keys } = await res.json();
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key).not.toHaveProperty('d');
  });
});
