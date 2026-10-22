import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { codeFrom } from '../../src/email/email';
import { address, call, cookieFrom, mobileLogin, ORIGIN, PASSWORD, registered, startHarness, webLogin, withBearer, withCookie, type Harness } from './fixtures/authHarness';

/**
 * Account endpoints (ImBackendImplementationPlan P5-05, P5-06): email change behind a code,
 * sessions and sign-out-others, connected accounts through the federated flow, and counters and
 * activity that only ever show the signed-in user's own rows.
 */
let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const json = async (res: Response) => (await res.json()) as Record<string, never>;

async function userId(email: string): Promise<string> {
  const row = await h.db.withSystem('test: find user', (tx) => tx.selectFrom('users').select('id').where('email', '=', email).executeTakeFirstOrThrow());
  return row.id;
}

describe('email change', () => {
  it('a code goes to the new address; nothing changes until it is confirmed; then sign-in uses the new address', async () => {
    const from = await registered(h);
    const to = address();
    const cookie = await webLogin(h, from);
    expect((await call(h, '/me/email', { body: { email: to }, headers: withCookie(cookie, true) })).status).toBe(202);
    expect(h.email.lastTo(from)?.subject).not.toMatch(/new NextKin email/);
    expect((await json(await call(h, '/me', { headers: withCookie(cookie) }))).email).toBe(from);
    const confirmed = await call(h, '/me/email/confirm', { body: { code: codeFrom(h.email.lastTo(to)) }, headers: withCookie(cookie, true) });
    expect(confirmed.status).toBe(200);
    expect(await json(confirmed)).toMatchObject({ email: to, emailVerified: true });
    await expect(webLogin(h, to)).resolves.toBeTruthy();
    expect((await call(h, '/auth/login', { body: { email: from, password: PASSWORD, client: 'mobile' } })).status).toBe(401);
  });

  it('an address that already has an account gets a notice, never a code, and the answer is the same', async () => {
    const taken = await registered(h);
    const cookie = await webLogin(h, await registered(h));
    const res = await call(h, '/me/email', { body: { email: taken }, headers: withCookie(cookie, true) });
    expect(res.status).toBe(202);
    expect(h.email.lastTo(taken)?.subject).toMatch(/tried to use your email/);
    expect(codeFrom(h.email.lastTo(taken))).toBeUndefined();
    expect((await call(h, '/me/email/confirm', { body: { code: '123456' }, headers: withCookie(cookie, true) })).status).toBe(400);
  });
});

describe('sessions', () => {
  it('lists every session, this one first and flagged, with readable platform names', async () => {
    const email = await registered(h);
    const res = await call(h, '/auth/login', { body: { email, password: PASSWORD, client: 'web' }, headers: { origin: ORIGIN, 'user-agent': MAC_CHROME } });
    const cookie = cookieFrom(res);
    await call(h, '/auth/login', { body: { email, password: PASSWORD, client: 'mobile' }, headers: { 'x-client': 'ios' } });
    const security = (await json(await call(h, '/me/security', { headers: withCookie(cookie) }))) as unknown as {
      twoFactorEnabled: boolean;
      sessions: { current: boolean; platform: string; browser: string; device: string }[];
    };
    expect(security.twoFactorEnabled).toBe(false);
    expect(security.sessions).toHaveLength(2);
    expect(security.sessions[0]).toMatchObject({ current: true, platform: 'Mac', browser: 'Chrome', device: 'desktop' });
    expect(security.sessions[1]).toMatchObject({ current: false, platform: 'iPhone', browser: 'NextKin app', device: 'phone' });
  });

  it('sign-out-others keeps this session and ends the rest, web and mobile alike', async () => {
    const email = await registered(h);
    const here = await webLogin(h, email);
    const otherWeb = await webLogin(h, email);
    const phone = await mobileLogin(h, email);
    expect((await call(h, '/auth/logout-others', { method: 'POST', headers: withCookie(here, true) })).status).toBe(204);
    expect((await call(h, '/auth/session', { headers: withCookie(here) })).status).toBe(200);
    expect((await call(h, '/auth/session', { headers: withCookie(otherWeb) })).status).toBe(401);
    expect((await call(h, '/auth/session', { headers: withBearer(phone.accessToken) })).status).toBe(401);
    expect((await call(h, '/auth/token/refresh', { body: { refreshToken: phone.refreshToken } })).status).toBe(401);
  });

  it('a password change is recorded as passwordChangedAt', async () => {
    const cookie = await webLogin(h, await registered(h));
    expect((await json(await call(h, '/me/security', { headers: withCookie(cookie) }))).passwordChangedAt).toBeUndefined();
    await call(h, '/auth/password/change', { body: { current: PASSWORD, next: 'a fresh passphrase now' }, headers: withCookie(cookie, true) });
    expect((await json(await call(h, '/me/security', { headers: withCookie(cookie) }))).passwordChangedAt).toEqual(expect.any(String));
  });
});

describe('connected accounts', () => {
  async function linkGoogle(cookie: string, googleSub: string, email: string) {
    const start = await call(h, '/auth/link/google?redirect=/settings', { headers: withCookie(cookie) });
    expect(start.status).toBe(302);
    const to = new URL(start.headers.get('location')!);
    const code = h.google.issueCode({ claims: { sub: googleSub, email, email_verified: true }, nonce: to.searchParams.get('nonce')!, codeChallenge: to.searchParams.get('code_challenge')!, redirectUri: `${ORIGIN}/api/v1/auth/callback` });
    return call(h, `/auth/callback?code=${code}&state=${to.searchParams.get('state')}`);
  }

  it('links Google through the provider and back, lists it, and unlinks it when a password remains', async () => {
    const email = await registered(h);
    const cookie = await webLogin(h, email);
    expect((await json(await call(h, '/me/connected-accounts', { headers: withCookie(cookie) }))).items).toEqual([{ provider: 'google', connected: false }]);
    const back = await linkGoogle(cookie, `g-${randomUUID()}`, email);
    expect(back.headers.get('location')).toBe(`${ORIGIN}/settings?linked=google`);
    const listed = (await json(await call(h, '/me/connected-accounts', { headers: withCookie(cookie) }))).items as unknown as { connected: boolean }[];
    expect(listed[0]).toMatchObject({ provider: 'google', connected: true, connectedAt: expect.any(String) });
    const unlinked = await call(h, '/me/connected-accounts/google', { method: 'DELETE', headers: withCookie(cookie, true) });
    expect((await json(unlinked)).items).toEqual([{ provider: 'google', connected: false }]);
  });

  it('a Google account already linked elsewhere comes back as link_error, not a takeover', async () => {
    const googleSub = `g-${randomUUID()}`;
    const first = await webLogin(h, await registered(h));
    await linkGoogle(first, googleSub, address());
    const second = await webLogin(h, await registered(h));
    const back = await linkGoogle(second, googleSub, address());
    expect(back.headers.get('location')).toBe(`${ORIGIN}/settings?link_error=already_linked`);
  });

  it('linking needs a session; unlinking the only sign-in method is refused (409)', async () => {
    expect((await call(h, '/auth/link/google')).status).toBe(401);
    const login = await call(h, '/auth/login/google');
    const to = new URL(login.headers.get('location')!);
    const code = h.google.issueCode({ claims: { sub: `g-${randomUUID()}`, email: address(), email_verified: true }, nonce: to.searchParams.get('nonce')!, codeChallenge: to.searchParams.get('code_challenge')!, redirectUri: `${ORIGIN}/api/v1/auth/callback` });
    const cookie = cookieFrom(await call(h, `/auth/callback?code=${code}&state=${to.searchParams.get('state')}`));
    const res = await call(h, '/me/connected-accounts/google', { method: 'DELETE', headers: withCookie(cookie, true) });
    expect(res.status).toBe(409);
  });
});

describe('dashboard and activity are the signed-in user\'s own', () => {
  it('counters and the feed never include another user\'s rows', async () => {
    const aEmail = await registered(h);
    const a = await webLogin(h, aEmail);
    const b = await webLogin(h, await registered(h));
    const aId = await userId(aEmail);
    await h.db.withUser({ userId: aId, role: 'user' }, (tx) => tx.insertInto('activity').values({ user_id: aId, kind: 'profile', title: 'Updated **profile**' }).execute());
    expect(await json(await call(h, '/me/dashboard', { headers: withCookie(a) }))).toEqual({ resumesCount: 0, activitiesCount: 1, savedJobsCount: 0 });
    expect(await json(await call(h, '/me/dashboard', { headers: withCookie(b) }))).toEqual({ resumesCount: 0, activitiesCount: 0, savedJobsCount: 0 });
    expect((await json(await call(h, '/me/activity', { headers: withCookie(b) }))).items).toEqual([]);
  });

  it('activity pages newest first and never skips or repeats, even with identical timestamps', async () => {
    const email = await registered(h);
    const cookie = await webLogin(h, email);
    const id = await userId(email);
    const at = new Date('2026-05-01T10:00:00.123456Z');
    await h.db.withUser({ userId: id, role: 'user' }, (tx) =>
      tx.insertInto('activity').values(Array.from({ length: 5 }, (_, i) => ({ user_id: id, kind: 'score', title: `Entry ${i}`, created_at: at }))).execute(),
    );
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = (await json(await call(h, `/me/activity?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { headers: withCookie(cookie) }))) as unknown as { items: { id: string }[]; nextCursor?: string };
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });
});

describe('notification preferences sit beside the job preferences', () => {
  it('changing one never clears the other', async () => {
    const cookie = await webLogin(h, await registered(h));
    const prefs = await json(await call(h, '/me/notification-prefs', { headers: withCookie(cookie) }));
    await call(h, '/me/notification-prefs', { method: 'PUT', body: { ...prefs, weeklyDigest: false }, headers: withCookie(cookie, true) });
    const etag = (await call(h, '/profile', { headers: withCookie(cookie) })).headers.get('etag')!;
    await call(h, '/profile/preferences', { method: 'PATCH', body: { remote: 'onsite' }, headers: { ...withCookie(cookie, true), 'if-match': etag } });
    expect((await json(await call(h, '/me/notification-prefs', { headers: withCookie(cookie) }))).weeklyDigest).toBe(false);
    expect(((await json(await call(h, '/profile', { headers: withCookie(cookie) }))).preferences as unknown as { remote: string }).remote).toBe('onsite');
  });
});
