import { sql } from 'kysely';

import type { Database } from '../../db/database';
import { errors } from '../../http/errors';
import { enqueue } from '../../outbox/outbox';
import { writeAudit, type RequestMeta } from './audit';
import { dbRole, type Staff } from './permissions';

/**
 * The deletion queue (Figma 408:2843; spec §8.5: finished within 30 days), over `account_deletions`
 * (0052). Deleting an account signs it out and releases its address at once (`deleteAccount`); the
 * daily purge then removes every row it owns and marks the request finished.
 *
 * Statuses, from the ledger:
 * - `signed_out`: deleted and signed out everywhere, waiting for the purge.
 * - `purging`: staff started the purge early ("Process now"); the worker is on it.
 * - `completed`: purged.
 * `scheduled` (a request not yet acted on) can't occur: every deletion is carried out when asked.
 */

export type DeletionFilter = 'all' | 'open' | 'completed';

export async function listDeletions(db: Database, staff: Staff, filter: DeletionFilter) {
  const rows = await db.withStaff({ userId: staff.identity.userId, role: dbRole(staff) }, 'admin: the deletion queue', (tx) => {
    let query = tx.selectFrom('account_deletions').select(['id', 'subject_user_id', 'origin', 'requested_at', 'due_at', 'purge_requested_at', 'completed_at']);
    if (filter === 'open') query = query.where('completed_at', 'is', null);
    if (filter === 'completed') query = query.where('completed_at', 'is not', null);
    return query.orderBy('requested_at', 'desc').limit(500).execute();
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.subject_user_id,
    origin: r.origin as 'user' | 'admin',
    requestedAt: new Date(r.requested_at).toISOString(),
    dueAt: new Date(r.due_at).toISOString(),
    status: r.completed_at ? 'completed' : r.purge_requested_at ? 'purging' : 'signed_out',
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
  }));
}

/**
 * Starts one waiting request's purge now rather than at the next daily run: the request is marked,
 * the audit row written, and the purge job queued, all in one transaction. The job purges every
 * deleted account that is waiting, this one included; it is idempotent (`scheduler/jobs.ts`).
 */
export async function processDeletion(db: Database, staff: Staff, requestId: string, reason: string, meta: RequestMeta) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw errors.notFound('deletion request');
  if (reason.trim().length < 3) throw errors.validation({ reason: 'at least 3 characters' }, 'Say why this purge can’t wait.');
  return db.withSystem(`admin ${staff.identity.userId}: start a purge early`, async (tx) => {
    const row = await tx.selectFrom('account_deletions').select(['id', 'subject_user_id', 'purge_requested_at', 'completed_at']).where('id', '=', requestId).forUpdate().executeTakeFirst();
    if (!row) throw errors.notFound('deletion request');
    if (row.completed_at) throw errors.conflict('This account has already been purged.');
    if (row.purge_requested_at) return { status: 'purging' as const };
    const now = new Date();
    await tx.updateTable('account_deletions').set({ purge_requested_at: sql`now()` }).where('id', '=', requestId).execute();
    await writeAudit(tx, staff, { action: 'user.deletion_process', targetType: 'user', targetId: row.subject_user_id, after: { requestId }, reason: reason.trim() }, meta);
    await enqueue(tx, { queue: 'maintenance', groupId: 'account_purge', type: 'maintenance.run', payload: { job: 'account_purge', windowStart: now.toISOString() }, correlationId: `admin-purge:${requestId}` });
    return { status: 'purging' as const };
  });
}
