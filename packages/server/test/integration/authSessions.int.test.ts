import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codeFrom } from '../../src/email/email';
import { totpAt } from '../../src/auth/totp';
import { SEED_PASSWORD, SEED_TOTP_SECRET } from '../../src/seed/identities';
import {
  address,
  call,
  cookieFrom,
  mobileLogin,
  ORIGIN,
  PASSWORD,
  registered,
  startHarness,
  webLogin,
  withBearer,
  withCookie,
  type Harness,
} from './fixtures/authHarness';

/**
 * Password sign-in and server sessions over HTTP (ImBackendImplementationPlan P4 exit). The point
 * that separates sessions from bare JWTs: after logout the very next request with the old cookie
 * or the old, still-unexpired access token is 401.
 */
let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

describe('sign-up and confirmation', () => {
  it('answers 202 the same way for new and existing emails', async () => {
    const to = await registered(h);
    const fresh = await call(h, '/auth/signup', { body: { email: address(), password: PASSWORD } });
    const taken = await call(h, '/auth/signup', { body: { email: to, password: PASSWORD } });
    expect([fresh.status, taken.status]).toEqual([202, 202]);
    expect(await taken.json()).toEqual(await fresh.json());
  });

  it('refuses sign-in until confirmed, with a hint the client can act on', async () => {
    const to = address();
    await call(h, '/auth/signup', { body: { email: to, password: PASSWORD } });
    const res = await call(h, '/auth/login', { body: { email: to, password: PASSWORD, client: 'mobile' } });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { details: { notConfirmed: true } } });
  });

  it('a weak password is a 400 on the password field', async () => {
    const res = await call(h, '/auth/signup', { body: { email: address(), password: 'password' } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED', details: { password: 'too_common' } } });
  });

  it('wrong password and unknown email are the same 401', async () => {
    const to = await registered(h);
    const wrong = await call(h, '/auth/login', { body: { email: to, password: 'not the password!', client: 'mobile' } });
    const unknown = await call(h, '/auth/login', { body: { email: address(), password: PASSWORD, client: 'mobile' } });
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect((await wrong.json()).error.message).toBe((await unknown.json()).error.message);
  });
});

describe('web sessions', () => {
  it('sign-in sets a __Host- cookie that is HttpOnly, Secure and SameSite', async () => {
    const res = await call(h, '/auth/login', { body: { email: await registered(h), password: PASSWORD, client: 'web' }, headers: { origin: ORIGIN } });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/^__Host-nk_session=[\w-]{40,}; Path=\/; HttpOnly; Secure; SameSite=Lax/);
  });

  it('login CSRF: a web sign-in from another origin, or with no origin signal, is refused', async () => {
    const to = await registered(h);
    const evil = await call(h, '/auth/login', { body: { email: to, password: PASSWORD, client: 'web' }, headers: { origin: 'https://evil.example' } });
    const none = await call(h, '/auth/login', { body: { email: to, password: PASSWORD, client: 'web' } });
    expect([evil.status, none.status]).toEqual([403, 403]);
  });

  it('a cookie request with a foreign Origin is refused (CSRF)', async () => {
    const cookie = await webLogin(h, await registered(h));
    const res = await call(h, '/auth/logout', { method: 'POST', headers: { cookie, origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
  });

  it('logout makes the very next request with the same cookie 401', async () => {
    const cookie = await webLogin(h, await registered(h));
    expect((await call(h, '/auth/session', { headers: withCookie(cookie) })).status).toBe(200);
    expect((await call(h, '/auth/logout', { method: 'POST', headers: withCookie(cookie, true) })).status).toBe(204);
    expect((await call(h, '/auth/session', { headers: withCookie(cookie) })).status).toBe(401);
  });

  it('a mobile session id presented as a cookie is not a web session', async () => {
    const tokens = await mobileLogin(h, await registered(h));
    const verified = await h.stack.identity.idp.verifyAccessToken(tokens.accessToken);
    expect((await call(h, '/auth/session', { headers: { cookie: `__Host-nk_session=${verified.sessionRef}` } })).status).toBe(401);
  });
});

describe('mobile sessions', () => {
  it('logout makes the still-unexpired access token 401 on the next call (unlike a bare JWT)', async () => {
    const tokens = await mobileLogin(h, await registered(h));
    expect((await call(h, '/auth/session', { headers: withBearer(tokens.accessToken) })).status).toBe(200);
    expect((await call(h, '/auth/logout', { method: 'POST', headers: withBearer(tokens.accessToken) })).status).toBe(204);
    // The token's signature and expiry are still fine; only the server session is gone.
    await expect(h.stack.identity.idp.verifyAccessToken(tokens.accessToken)).resolves.toBeTruthy();
    expect((await call(h, '/auth/session', { headers: withBearer(tokens.accessToken) })).status).toBe(401);
    expect((await call(h, '/auth/token/refresh', { body: { refreshToken: tokens.refreshToken } })).status).toBe(401);
  });

  it('logout-all ends web and mobile sessions alike', async () => {
    const to = await registered(h);
    const cookie = await webLogin(h, to);
    const tokens = await mobileLogin(h, to);
    expect((await call(h, '/auth/logout-all', { method: 'POST', headers: withBearer(tokens.accessToken) })).status).toBe(204);
    expect((await call(h, '/auth/session', { headers: withCookie(cookie) })).status).toBe(401);
    expect((await call(h, '/auth/session', { headers: withBearer(tokens.accessToken) })).status).toBe(401);
  });
});

describe('passwords', () => {
  it('changing the password keeps this session and ends every other one', async () => {
    const to = await registered(h);
    const here = await webLogin(h, to);
    const elsewhere = await mobileLogin(h, to);
    const wrong = await call(h, '/auth/password/change', { body: { current: 'not my password', next: 'a whole new passphrase' }, headers: withCookie(here, true) });
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toMatchObject({ error: { details: { current: 'incorrect' } } });
    const res = await call(h, '/auth/password/change', { body: { current: PASSWORD, next: 'a whole new passphrase' }, headers: withCookie(here, true) });
    expect(res.status).toBe(204);
    expect((await call(h, '/auth/session', { headers: withCookie(here) })).status).toBe(200);
    expect((await call(h, '/auth/session', { headers: withBearer(elsewhere.accessToken) })).status).toBe(401);
  });

  it('a reset ends every session, and the new password works', async () => {
    const to = await registered(h);
    const cookie = await webLogin(h, to);
    expect((await call(h, '/auth/password/forgot', { body: { email: to } })).status).toBe(202);
    const reset = await call(h, '/auth/password/reset', { body: { email: to, code: codeFrom(h.email.lastTo(to)), password: 'reset passphrase here' } });
    expect(reset.status).toBe(204);
    expect((await call(h, '/auth/session', { headers: withCookie(cookie) })).status).toBe(401);
    await expect(webLogin(h, to, 'reset passphrase here')).resolves.toBeTruthy();
  });

  it('five wrong passwords lock the account, even against the right one', async () => {
    const to = await registered(h);
    for (let i = 0; i < 5; i++) await call(h, '/auth/login', { body: { email: to, password: 'wrong wrong wrong', client: 'mobile' } });
    expect((await call(h, '/auth/login', { body: { email: to, password: PASSWORD, client: 'mobile' } })).status).toBe(401);
  });
});

describe('auth events are recorded', () => {
  it('sign-up, sign-in and sign-out land in security_events', async () => {
    const to = await registered(h);
    const cookie = await webLogin(h, to);
    const tokens = await mobileLogin(h, to);
    await call(h, '/auth/logout', { method: 'POST', headers: withCookie(cookie, true) });
    const user = await h.db.withSystem('test: find user', (tx) => tx.selectFrom('users').select('id').where('email', '=', to).executeTakeFirstOrThrow());
    const kinds = await h.db.withUser({ userId: user.id, role: 'user' }, (tx) => tx.selectFrom('security_events').select('kind').orderBy('created_at').execute());
    expect(kinds.map((k) => k.kind)).toEqual(['sign_up', 'sign_in', 'sign_out']);
    expect(tokens.accessToken).toBeTruthy();
  });
});

describe('staff sign-in (admins pool)', () => {
  it('needs TOTP, gets the staff role, and the seeded staff account works', async () => {
    const body = { email: 'support@nextkin.test', password: SEED_PASSWORD };
    const missing = await call(h, '/auth/admin/login', { body, headers: { origin: ORIGIN } });
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({ error: { details: { mfaRequired: true } } });
    const res = await call(h, '/auth/admin/login', { body: { ...body, totp: totpAt(SEED_TOTP_SECRET, Date.now()) }, headers: { origin: ORIGIN } });
    expect(res.status).toBe(200);
    expect((await res.json()).user.role).toBe('support');
    await call(h, '/auth/logout', { method: 'POST', headers: withCookie(cookieFrom(res), true) });
  });

  it('a staff account cannot sign in through the users login', async () => {
    const res = await call(h, '/auth/login', { body: { email: 'support@nextkin.test', password: SEED_PASSWORD, client: 'mobile' } });
    expect(res.status).toBe(401);
  });
});
