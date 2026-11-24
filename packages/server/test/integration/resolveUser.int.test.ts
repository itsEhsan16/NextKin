import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthError, type IdentityProfile } from '../../src/auth/ports/identity';
import { resolveUser } from '../../src/auth/users';
import { startHarness, type Harness } from './fixtures/authHarness';

/**
 * Linking a new identity to an account by its verified email (V2 §7.1; owner, 2026-11-24): the
 * same person arriving by Google, or every user after the move to Clerk's production instance.
 */
const DOMAIN = 'nkt-link.test';
let h: Harness;

beforeAll(async () => {
  h = await startHarness({});
});
afterAll(async () => {
  await h.db.withSystem('test: tidy link rows', (tx) => tx.deleteFrom('users').where('email', 'like', `%@${DOMAIN}`).execute());
  await h.close();
});

const profile = (email: string, over: Partial<IdentityProfile> = {}): IdentityProfile => ({
  sub: `clerk|user_${randomUUID()}`,
  pool: 'users',
  email,
  emailVerified: true,
  name: 'Ada Lovelace',
  groups: [],
  ...over,
});

const subOf = (userId: string) =>
  h.db.withSystem('test: read sub', (tx) => tx.selectFrom('users').select(['identity_sub', 'status']).where('id', '=', userId).executeTakeFirstOrThrow());

async function existing(email: string, role: 'user' | 'admin' = 'user') {
  const first = await resolveUser(h.db, profile(email));
  if (role !== 'user') {
    await h.db.withSystem('test: make staff', (tx) => tx.updateTable('users').set({ role }).where('id', '=', first.userId).execute());
  }
  return first;
}

describe('resolveUser links by verified email', () => {
  it('a known sub signs in to its own account', async () => {
    const p = profile(`known-${randomUUID().slice(0, 8)}@${DOMAIN}`);
    const first = await resolveUser(h.db, p);
    const again = await resolveUser(h.db, p);
    expect(first.created).toBe(true);
    expect(again).toMatchObject({ userId: first.userId, created: false, linked: false });
  });

  it('a new sub with the same verified email (any case) takes over the account', async () => {
    const email = `ada-${randomUUID().slice(0, 8)}@${DOMAIN}`;
    const first = await existing(email);
    const google = profile(email.toUpperCase());
    const linked = await resolveUser(h.db, google);
    expect(linked).toMatchObject({ userId: first.userId, created: false, linked: true });
    expect((await subOf(first.userId)).identity_sub).toBe(google.sub);
  });

  it('an unverified email never takes over an account', async () => {
    const email = `unverified-${randomUUID().slice(0, 8)}@${DOMAIN}`;
    const first = await existing(email);
    const before = (await subOf(first.userId)).identity_sub;
    await expect(resolveUser(h.db, profile(email, { emailVerified: false }))).rejects.toMatchObject({ failure: 'email_in_use' });
    expect((await subOf(first.userId)).identity_sub).toBe(before);
  });

  it('staff accounts and the admins pool never link by email', async () => {
    const email = `staff-${randomUUID().slice(0, 8)}@${DOMAIN}`;
    const staff = await existing(email, 'admin');
    const before = (await subOf(staff.userId)).identity_sub;
    await expect(resolveUser(h.db, profile(email))).rejects.toBeInstanceOf(AuthError);
    await expect(resolveUser(h.db, profile(email, { pool: 'admins', groups: ['admin'] }))).rejects.toMatchObject({ failure: 'email_in_use' });
    expect((await subOf(staff.userId)).identity_sub).toBe(before);
  });

  it('a deleted account is not revived', async () => {
    const email = `deleted-${randomUUID().slice(0, 8)}@${DOMAIN}`;
    const first = await existing(email);
    await h.db.withSystem('test: mark deleted', (tx) => tx.updateTable('users').set({ status: 'deleted' }).where('id', '=', first.userId).execute());
    await expect(resolveUser(h.db, profile(email))).rejects.toMatchObject({ failure: 'email_in_use' });
  });
});
