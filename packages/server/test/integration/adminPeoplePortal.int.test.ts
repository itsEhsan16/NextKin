import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Staff } from '../../src/services/admin/permissions';
import * as people from '../../src/services/admin/people';
import { userProfile } from '../../src/services/admin/peopleDetail';
import * as deletions from '../../src/services/admin/peopleDeletions';
import * as users from '../../src/services/admin/users';
import { deleteAccount, purgeDeletedAccounts } from '../../src/services/privacy';
import type { StoragePort } from '../../src/storage/storage';
import { log } from './fixtures/pipeline';
import { mobileLogin, registered, startHarness, type Harness } from './fixtures/authHarness';

/**
 * The admin portal's People area against Postgres (toreview §171.13): totals from real rows,
 * browsing with filters and short searches, the detail page's plan, comp and staff actions, and
 * the deletion ledger (0052) from request to purge.
 */
let h: Harness;
const meta = { ip: '127.0.0.1', requestId: 'req-people-test' };

beforeAll(async () => {
  h = await startHarness({});
});
afterAll(async () => {
  await h.db.withSystem('test: tidy staff rows', (tx) => tx.deleteFrom('users').where('email', 'like', '%@nkt-people.test').execute());
  await h.close();
});

async function staffMember(level: Staff['level']): Promise<Staff> {
  const userId = randomUUID();
  const role = level === 'super_admin' ? 'admin' : level;
  await h.db.withUser({ userId, role: 'user' }, (tx) => tx.insertInto('users').values({ id: userId, identity_sub: `local|staff-${userId}`, email: `staff-${userId.slice(0, 8)}@nkt-people.test`, first_name: 'Priya', last_name: 'Rao', role }).execute());
  return { identity: { userId, role }, level };
}

async function member() {
  const email = await registered(h);
  await mobileLogin(h, email);
  const user = await h.db.withSystem('test: find the user', (tx) => tx.selectFrom('users').select('id').where('email', '=', email).executeTakeFirstOrThrow());
  return { email, userId: user.id };
}

const deps = () => ({ db: h.db, log, provider: { name: 'fake', cancelNowAndRefund: async () => {} } as never, idp: h.stack.identity.idp, sessions: h.stack.identity.sessions });
const noStorage = { remove: async () => {} } as unknown as StoragePort;

describe('the People area (admin portal)', () => {
  it('browses every account: a search of any length, the plan filters, and the row facts', async () => {
    const support = await staffMember('support');
    const user = await member();
    const prefix = user.email.slice(0, 1);
    const short = await people.browseUsers(h.db, support, { filter: 'all', q: prefix, sort: 'desc', page: 1 });
    expect(short.matched).toBeGreaterThan(0);

    const found = await people.browseUsers(h.db, support, { filter: 'free', q: user.email, sort: 'desc', page: 1 });
    expect(found.rows).toHaveLength(1);
    expect(found.rows[0]).toMatchObject({ id: user.userId, plan: 'free', resumes: 0, usage: { used: 0 } });
    // Signed in just now, so it has been active.
    expect(found.rows[0]!.lastActiveAt).not.toBeNull();
    expect((await people.browseUsers(h.db, support, { filter: 'pro', q: user.email, sort: 'desc', page: 1 })).matched).toBe(0);
  });

  it('counts comps and suspensions by reason, and the detail page shows what staff did', async () => {
    const admin = await staffMember('admin');
    const user = await member();
    const before = await people.userStats(h.db, admin);

    await users.grantComp(h.db, admin, user.userId, 2, 'goodwill credit', meta);
    const pro = await people.browseUsers(h.db, admin, { filter: 'pro', q: user.email, sort: 'desc', page: 1 });
    expect(pro.rows[0]).toMatchObject({ plan: 'pro', status: 'comped' });

    await users.setUserStatus(deps(), admin, user.userId, 'suspended', 'fraud', 'card testing', meta);
    const after = await people.userStats(h.db, admin);
    expect(after.comped).toBe(before.comped + 1);
    expect(after.suspended).toBe(before.suspended + 1);
    expect(after.suspendedBy.fraud).toBe(before.suspendedBy.fraud + 1);

    const detail = await userProfile(h.db, admin, user.userId);
    expect(detail.plan).toBe('pro');
    expect(detail.rowStatus).toBe('suspended');
    expect(detail.compedUntil).not.toBeNull();
    // A comp is not a paid subscription: there is no billing to show.
    expect(detail.billing).toBeNull();
    expect(detail.adminActions.map((a) => a.kind)).toEqual(['suspended', 'comped']);
    expect(detail.adminActions[0]).toMatchObject({ by: 'Priya R.', note: 'fraud: card testing' });
    expect(detail.securityEventCount).toBeGreaterThan(0);
  });

  it('records each deletion in the ledger, starts a purge early with an audit row, and finishes it', async () => {
    const admin = await staffMember('admin');
    const self = await member();
    const byStaff = await member();

    await deleteAccount(deps(), { userId: self.userId, role: 'user' });
    await users.processDeletion(deps(), admin, byStaff.userId, 'legal request 4411', meta);

    const open = await deletions.listDeletions(h.db, admin, 'open');
    const mine = open.find((r) => r.userId === self.userId)!;
    const theirs = open.find((r) => r.userId === byStaff.userId)!;
    expect(mine).toMatchObject({ origin: 'user', status: 'signed_out', completedAt: null });
    expect(theirs).toMatchObject({ origin: 'admin', status: 'signed_out' });
    expect(Date.parse(mine.dueAt) - Date.parse(mine.requestedAt)).toBe(30 * 86_400_000);
    expect((await people.userStats(h.db, admin)).pendingDeletion).toBeGreaterThanOrEqual(2);

    await expect(deletions.processDeletion(h.db, admin, mine.id, 'x', meta)).rejects.toThrow();
    expect(await deletions.processDeletion(h.db, admin, mine.id, 'user asked twice', meta)).toEqual({ status: 'purging' });
    const queued = await h.db.withSystem('test: read the outbox', (tx) => tx.selectFrom('outbox').select('correlation_id').where('correlation_id', '=', `admin-purge:${mine.id}`).execute());
    expect(queued).toHaveLength(1);
    expect((await deletions.listDeletions(h.db, admin, 'open')).find((r) => r.id === mine.id)!.status).toBe('purging');

    await purgeDeletedAccounts({ db: h.db, storage: noStorage, exportsBucket: 'exports', uploadsBucket: 'uploads', log });
    const done = await deletions.listDeletions(h.db, admin, 'completed');
    expect(done.find((r) => r.id === mine.id)!.status).toBe('completed');
    expect(done.find((r) => r.userId === byStaff.userId)!.completedAt).not.toBeNull();
    await expect(deletions.processDeletion(h.db, admin, mine.id, 'too late now', meta)).rejects.toThrow(/already been purged/);
  });
});
