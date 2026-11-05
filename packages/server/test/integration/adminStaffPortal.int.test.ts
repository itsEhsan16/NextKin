import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { totpAt } from '../../src/auth/totp';
import { readSessionCookie } from '../../src/auth/sessions';
import { call, cookieFrom, DOMAIN, ORIGIN, PASSWORD, startHarness, withCookie, type Harness } from './fixtures/authHarness';
import { makeStaff, staffLogin } from './fixtures/staffAccounts';

/**
 * Staff sign-in and staff management (toreview §171.13): the server's own staff accounts with a
 * password and an authenticator, never the users' identity provider. A new account's first sign-in
 * sets up the authenticator and replaces the temporary password before any session exists.
 */
let h: Harness;
beforeAll(async () => {
  h = await startHarness({});
});
afterAll(async () => {
  await h.db.withSystem('test: reset the admin policy', (tx) => tx.updateTable('admin_settings').set({ reauth_for_sensitive: true, allowed_networks: '[]', session_timeout_minutes: 30 }).execute());
  await h.close();
});

const login = (body: Record<string, unknown>) => call(h, '/auth/admin/login', { body, headers: { origin: ORIGIN } });
const step = (path: string, body: Record<string, unknown>) => call(h, `/auth/admin/${path}`, { body, headers: { origin: ORIGIN } });
/** The next 30-second step's code, so a test can use a second code without waiting. */
const nextCode = (secret: string) => totpAt(secret, Date.now() + 30_000);

describe('first sign-in of a new staff account', () => {
  it('sets up the authenticator, then replaces the temporary password, then signs in', async () => {
    const member = await makeStaff(h, 'curator', { enrolled: false, mustChange: true });

    const first = await login({ email: member.email, password: member.password });
    expect(first.status).toBe(200);
    const enrol = await first.json();
    expect(enrol).toMatchObject({ status: 'enroll_totp', otpauthUrl: expect.stringContaining('otpauth://totp/NextKin:') });
    expect(first.headers.get('set-cookie')).toBeNull();

    expect((await step('enroll', { challenge: enrol.challenge, code: '000000' })).status).toBe(422);
    const enrolled = await step('enroll', { challenge: enrol.challenge, code: totpAt(enrol.secret, Date.now()) });
    const change = await enrolled.json();
    expect(change).toMatchObject({ status: 'change_password', backupCodes: expect.any(Array) });
    expect(change.backupCodes).toHaveLength(10);
    expect(enrolled.headers.get('set-cookie')).toBeNull();

    // Too short, then the temporary password itself: both refused, the step stays open.
    expect((await step('password', { challenge: change.challenge, password: 'short-one' })).status).toBe(422);
    expect((await step('password', { challenge: change.challenge, password: member.password })).status).toBe(422);
    const done = await step('password', { challenge: change.challenge, password: 'a brand new staff passphrase' });
    expect(done.status).toBe(200);
    expect(await done.json()).toMatchObject({ status: 'signed_in', user: { role: 'curator' } });
    const cookie = cookieFrom(done);
    expect((await call(h, '/admin/me', { headers: withCookie(cookie) })).status).toBe(200);

    // The challenge is spent, and the old password no longer works.
    expect((await step('password', { challenge: change.challenge, password: 'another new passphrase!' })).status).toBe(422);
    expect((await login({ email: member.email, password: member.password })).status).toBe(401);
    const again = await login({ email: member.email, password: 'a brand new staff passphrase', totp: nextCode(enrol.secret) });
    expect(await again.json()).toMatchObject({ status: 'signed_in' });

    // One of the backup codes works once.
    const code = change.backupCodes[0];
    expect((await login({ email: member.email, password: 'a brand new staff passphrase', totp: code })).status).toBe(200);
    expect((await login({ email: member.email, password: 'a brand new staff passphrase', totp: code })).status).toBe(401);
  });
});

describe('signing in to an enrolled account', () => {
  it('asks for the code, refuses a reused one, and locks after five failures', async () => {
    const member = await makeStaff(h, 'support');
    expect(await (await login({ email: member.email, password: member.password })).json()).toEqual({ status: 'mfa_required' });

    const code = totpAt(member.secret, Date.now());
    expect((await login({ email: member.email, password: member.password, totp: code })).status).toBe(200);
    expect((await login({ email: member.email, password: member.password, totp: code })).status).toBe(401);

    for (let i = 0; i < 5; i++) expect((await login({ email: member.email, password: 'not the password at all' })).status).toBe(401);
    // Locked: even the right password and a fresh code are refused, the same way.
    expect((await login({ email: member.email, password: member.password, totp: nextCode(member.secret) })).status).toBe(401);
  });

  it('a users-pool account is not a staff account', async () => {
    expect((await login({ email: `nobody@${DOMAIN}`, password: PASSWORD })).status).toBe(401);
  });
});

describe('staff management (Super Admin)', () => {
  it('invites with a temporary password, emailed and shown once; the invitee then signs in', async () => {
    const boss = await staffLogin(h, await makeStaff(h, 'super_admin'));
    const email = `invitee-${Date.now()}@${DOMAIN}`;
    const res = await call(h, '/admin/staff', { body: { name: 'Ivy Invitee', email, role: 'support' }, headers: withCookie(boss, true) });
    expect(res.status).toBe(201);
    const invited = await res.json();
    expect(invited).toMatchObject({ member: { email, role: 'support', mfa: 'none', status: 'invited' }, emailed: true });
    expect(h.email.lastTo(email)?.text).toContain(invited.temporaryPassword);

    expect((await call(h, '/admin/staff', { body: { name: 'Ivy Again', email, role: 'support' }, headers: withCookie(boss, true) })).status).toBe(409);
    const list = await (await call(h, '/admin/staff', { headers: withCookie(boss) })).json();
    expect(list.data.map((m: { email: string }) => m.email)).toContain(email);

    expect(await (await login({ email, password: invited.temporaryPassword })).json()).toMatchObject({ status: 'enroll_totp' });
  });

  it('re-roles and resets, ends the member’s sessions, and keeps one Super Admin', async () => {
    const bossMember = await makeStaff(h, 'super_admin');
    const boss = await staffLogin(h, bossMember);
    const target = await makeStaff(h, 'support');
    const targetCookie = await staffLogin(h, target);

    const role = await call(h, `/admin/staff/${target.userId}/role`, { method: 'PUT', body: { role: 'curator' }, headers: withCookie(boss, true) });
    expect(role.status).toBe(200);
    expect((await call(h, '/admin/me', { headers: withCookie(targetCookie) })).status).toBe(401);
    const row = await h.db.withSystem('test: read the role', (tx) => tx.selectFrom('users').select('role').where('id', '=', target.userId).executeTakeFirstOrThrow());
    expect(row.role).toBe('curator');
    expect((await call(h, `/admin/staff/${bossMember.userId}/role`, { method: 'PUT', body: { role: 'admin' }, headers: withCookie(boss, true) })).status).toBe(409);

    const reset = await call(h, `/admin/staff/${target.userId}/reset`, { method: 'POST', headers: withCookie(boss, true) });
    const { temporaryPassword } = await reset.json();
    expect(await (await login({ email: target.email, password: temporaryPassword })).json()).toMatchObject({ status: 'enroll_totp' });
    expect((await login({ email: target.email, password: target.password })).status).toBe(401);
  });

  it('is Super Admin only', async () => {
    const admin = await staffLogin(h, await makeStaff(h, 'admin'));
    expect((await call(h, '/admin/staff', { headers: withCookie(admin) })).status).toBe(403);
  });
});

describe('Settings', () => {
  it('reads for any staff member; the policy changes for Super Admin only, never locking them out', async () => {
    const curator = await staffLogin(h, await makeStaff(h, 'curator'));
    const read = await (await call(h, '/admin/settings', { headers: withCookie(curator) })).json();
    expect(read).toMatchObject({ requireMfa: true, backupCodes: { unused: 0, total: 0 }, authenticator: { addedAt: expect.any(String) } });
    expect((await call(h, '/admin/settings', { method: 'PATCH', body: { sessionTimeoutMinutes: 15 }, headers: withCookie(curator, true) })).status).toBe(403);

    const boss = await staffLogin(h, await makeStaff(h, 'super_admin'));
    const patched = await call(h, '/admin/settings', { method: 'PATCH', body: { sessionTimeoutMinutes: 60 }, headers: withCookie(boss, true) });
    expect(await patched.json()).toMatchObject({ sessionTimeoutMinutes: 60 });
    // The suite's requests carry no client address, so any list would shut this session out.
    const lockout = await call(h, '/admin/settings', { method: 'PATCH', body: { allowedNetworks: [{ cidr: '203.0.113.0/24', label: 'Office' }] }, headers: withCookie(boss, true) });
    expect(lockout.status).toBe(422);

    const codes = await (await call(h, '/admin/settings/backup-codes', { method: 'POST', headers: withCookie(curator, true) })).json();
    expect(codes.codes).toHaveLength(10);
  });

  it('asks for the authenticator again before a sensitive action once the proof is old', async () => {
    const member = await makeStaff(h, 'super_admin');
    const cookie = await staffLogin(h, member);
    const id = readSessionCookie(cookie)!;
    await h.stack.identity.sessions.update(id, { mfaAt: Date.now() - 60 * 60_000 });

    const refused = await call(h, '/admin/settings', { method: 'PATCH', body: {}, headers: withCookie(cookie, true) });
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ error: { details: { reauthRequired: true } } });
    expect((await call(h, '/auth/admin/reauth', { body: { code: nextCode(member.secret) }, headers: withCookie(cookie, true) })).status).toBe(204);
    expect((await call(h, '/admin/settings', { method: 'PATCH', body: {}, headers: withCookie(cookie, true) })).status).toBe(200);
  });

  it('replaces the authenticator after one code from the new one', async () => {
    const member = await makeStaff(h, 'support');
    const cookie = await staffLogin(h, member);
    const begun = await (await call(h, '/admin/settings/authenticator', { method: 'POST', headers: withCookie(cookie, true) })).json();
    const confirmed = await call(h, '/admin/settings/authenticator/confirm', { body: { challenge: begun.challenge, code: totpAt(begun.secret, Date.now()) }, headers: withCookie(cookie, true) });
    expect((await confirmed.json()).backupCodes).toHaveLength(10);
    // The old authenticator no longer signs in; the new one does.
    expect((await login({ email: member.email, password: member.password, totp: nextCode(member.secret) })).status).toBe(401);
  });
});
