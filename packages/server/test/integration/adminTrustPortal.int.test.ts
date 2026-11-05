import { createHash, randomUUID } from 'node:crypto';

import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { searchAudit } from '../../src/services/admin/audit';
import type { Staff } from '../../src/services/admin/permissions';
import * as failures from '../../src/services/admin/trustFailures';
import * as reports from '../../src/services/admin/trustReports';
import { log } from './fixtures/pipeline';
import { ORIGIN, registered, startHarness, type Harness } from './fixtures/authHarness';

/**
 * The admin portal's Trust & safety backend against Postgres (toreview §171.13): the failure queue
 * reads real runs, a staff retry is the owner's own retry and is audited, a close is durable; a
 * public report lands in the queue and settling it takes the link down or suspends its owner.
 */
let h: Harness;
const meta = { ip: '127.0.0.1', requestId: 'req-trust-test' };

beforeAll(async () => {
  h = await startHarness({});
});
afterAll(async () => {
  await h.db.withSystem('test: tidy staff rows', (tx) => tx.deleteFrom('users').where('email', 'like', '%@nkt-trust.test').execute());
  await h.close();
});

async function staffMember(level: Staff['level']): Promise<Staff> {
  const userId = randomUUID();
  const role = level === 'super_admin' ? 'admin' : level;
  await h.db.withUser({ userId, role: 'user' }, (tx) => tx.insertInto('users').values({ id: userId, identity_sub: `local|trust-${userId}`, email: `staff-${userId.slice(0, 8)}@nkt-trust.test`, role }).execute());
  return { identity: { userId, role }, level };
}

async function member(): Promise<string> {
  const email = await registered(h);
  const user = await h.db.withSystem('test: find the user', (tx) => tx.selectFrom('users').select('id').where('email', '=', email).executeTakeFirstOrThrow());
  return user.id;
}

/** A finished run that failed at `stage` with `code`, as the runner leaves one. */
async function failedRun(userId: string, kind: string, code: string, stage = 'generate', attempt = 5): Promise<string> {
  return h.db.withUser({ userId, role: 'user' }, async (tx) => {
    const run = await tx
      .insertInto('generations')
      .values({ user_id: userId, kind, status: 'failed', attempt, error_code: code, error_message: 'We couldn’t finish this. Try again.', idempotency_key: `trust-${randomUUID()}`, started_at: sql`now() - interval '2 minutes'`, finished_at: sql`now()` })
      .returning('id')
      .executeTakeFirstOrThrow();
    await tx.insertInto('generation_events').values({ generation_id: run.id, user_id: userId, event: 'stage_started', stage, snapshot: JSON.stringify({ status: 'generating' }) }).execute();
    await tx.insertInto('generation_events').values({ generation_id: run.id, user_id: userId, event: 'failed', stage, snapshot: JSON.stringify({ status: 'failed', ...(code === 'cancelled' ? { cancelled: true } : {}) }) }).execute();
    return run.id;
  });
}

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

async function sharedLink(userId: string): Promise<{ id: string; token: string }> {
  const token = `trust-${randomUUID()}`;
  const row = await h.db.withUser({ userId, role: 'user' }, (tx) =>
    tx.insertInto('shared_reports').values({ user_id: userId, token_hash: hashOf(token), snapshot: JSON.stringify({ total: null }) }).returning('id').executeTakeFirstOrThrow(),
  );
  return { id: row.id, token };
}

const fileReport = (token: string, body: unknown) =>
  h.app.request(`/api/v1/public/shared-reports/${token}/abuse-reports`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(body) });

describe('the generation-failure queue', () => {
  it('lists a run that failed, not one the user cancelled, and counts it', async () => {
    const support = await staffMember('support');
    const userId = await member();
    const failed = await failedRun(userId, 'cover_letter', 'dead_lettered');
    const cancelled = await failedRun(userId, 'cover_letter', 'cancelled');

    const { rows } = await failures.listFailures(h.db, support);
    const row = rows.find((r) => r.id === failed);
    expect(row).toMatchObject({ kind: 'cover_letter', stage: 'generate', errorCode: 'dead_lettered', status: 'open', attempts: 5, userRef: userId });
    expect(rows.some((r) => r.id === cancelled)).toBe(false);

    const stats = await failures.failureStats(h.db, support);
    expect(stats.open).toBeGreaterThanOrEqual(1);
    expect(stats.failed30d).toBeGreaterThanOrEqual(1);
    expect(stats.totalRuns30d).toBeGreaterThanOrEqual(2);

    const detail = await failures.failureDetail(h.db, support, failed);
    expect(detail.stages.find((s) => s.name === 'generate')).toMatchObject({ outcome: 'failed' });
    expect(detail).toMatchObject({ prompt: null, model: null, tokensIn: 0, error: { requestRef: null } });
  });

  it('a close is durable and audited; the queue then calls it resolved', async () => {
    const admin = await staffMember('admin');
    const userId = await member();
    const id = await failedRun(userId, 'interview', 'invalid', 'interviewWrite', 1);
    await failures.resolveFailure(h.db, admin, id, meta);
    expect((await failures.listFailures(h.db, admin)).rows.find((r) => r.id === id)?.status).toBe('resolved');
    expect((await searchAudit(h.db, admin, { actor: admin.identity.userId })).map((r) => r.action)).toContain('generation.resolve');
  });

  it('a staff retry queues the owner’s run again, keeps its error code, and is audited', async () => {
    const admin = await staffMember('admin');
    const userId = await member();
    const id = await failedRun(userId, 'ats_check', 'timed_out', 'atsScore');
    const outcome = await failures.retryFailures(h.db, admin, [id, randomUUID()], meta);
    expect(outcome.retried).toEqual([id]);
    expect(outcome.skipped).toHaveLength(1);

    const run = await h.db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('generations').select(['status', 'error_code']).where('id', '=', id).executeTakeFirstOrThrow());
    expect(run).toEqual({ status: 'queued', error_code: null });
    const row = (await failures.listFailures(h.db, admin)).rows.find((r) => r.id === id);
    expect(row).toMatchObject({ status: 'retrying', errorCode: 'timed_out', stage: 'atsScore' });
    expect((await searchAudit(h.db, admin, { actor: admin.identity.userId })).map((r) => r.action)).toContain('generation.retry');

    // A run already retrying is skipped, not retried twice.
    expect((await failures.retryFailures(h.db, admin, [id], meta)).skipped).toEqual([{ id, reason: 'retrying' }]);
  });
});

describe('abuse reports', () => {
  it('anyone with a live link can report it; an unknown token is not found', async () => {
    const userId = await member();
    const link = await sharedLink(userId);
    expect((await fileReport(link.token, { category: 'spam', reason: 'Selling followers' })).status).toBe(202);
    expect((await fileReport('no-such-token', { category: 'spam' })).status).toBe(404);
    expect((await fileReport(link.token, { category: 'not-a-category' })).status).toBe(400);

    const support = await staffMember('support');
    const { rows } = await reports.listReports(h.db, support);
    const row = rows.find((r) => r.item.ref === link.id);
    expect(row).toMatchObject({ category: 'spam', status: 'open', reporter: 'anonymous' });
    const detail = await reports.reportDetail(h.db, support, row!.id);
    expect(detail).toMatchObject({ reason: 'Selling followers', ownerRef: userId, views: null, outcome: null });
    expect((await reports.reportStats(h.db, support)).open).toBeGreaterThanOrEqual(1);
  });

  it('disabling the link revokes it, settles the report once, and is audited', async () => {
    const admin = await staffMember('admin');
    const userId = await member();
    const link = await sharedLink(userId);
    await fileReport(link.token, { category: 'impersonation', reason: 'Not me' });
    const row = (await reports.listReports(h.db, admin)).rows.find((r) => r.item.ref === link.id)!;
    const deps = { db: h.db, log, provider: { name: 'fake' } as never, idp: h.stack.identity.idp, sessions: h.stack.identity.sessions };

    const settled = await reports.actOnReport(deps, admin, row.id, { action: 'disable_link', reason: 'impersonation', note: 'confirmed' }, meta);
    expect(settled).toMatchObject({ status: 'resolved', outcome: { action: 'disable_link', reason: 'impersonation', note: 'confirmed' } });
    expect((await h.app.request(`/api/v1/public/shared-reports/${link.token}`)).status).toBe(404);
    await expect(reports.actOnReport(deps, admin, row.id, { action: 'dismiss', reason: 'x', note: '' }, meta)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await searchAudit(h.db, admin, { actor: admin.identity.userId })).map((r) => r.action)).toContain('abuse_report.disable_link');
  });

  it('suspending the owner suspends the account and takes the link down; prior reports count', async () => {
    const admin = await staffMember('admin');
    const userId = await member();
    const first = await sharedLink(userId);
    const second = await sharedLink(userId);
    await fileReport(first.token, { category: 'harassment' });
    await fileReport(second.token, { category: 'harassment' });
    const row = (await reports.listReports(h.db, admin)).rows.find((r) => r.item.ref === second.id)!;
    expect((await reports.reportDetail(h.db, admin, row.id)).prior?.count).toBe(1);

    const deps = { db: h.db, log, provider: { name: 'fake' } as never, idp: h.stack.identity.idp, sessions: h.stack.identity.sessions };
    await reports.actOnReport(deps, admin, row.id, { action: 'suspend_owner', reason: 'harassment', note: '' }, meta);
    const user = await h.db.withSystem('test: read status', (tx) => tx.selectFrom('users').select('status').where('id', '=', userId).executeTakeFirstOrThrow());
    expect(user.status).toBe('suspended');
    expect((await h.app.request(`/api/v1/public/shared-reports/${second.token}`)).status).toBe(404);
    const stats = await reports.reportStats(h.db, admin);
    expect(stats.settled30d.suspensions).toBeGreaterThanOrEqual(1);
    expect(stats.medianResolveHours).not.toBeNull();
  });
});
