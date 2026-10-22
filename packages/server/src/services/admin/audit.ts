import type { Database, Tx } from '../../db/database';
import type { StoragePort } from '../../storage/storage';
import { dbRole, type Staff } from './permissions';

/**
 * The audit log (ImBackendImplementationPlan P12-02; spec §7.17). Every admin mutation writes one
 * row in the same transaction as the change. Rows are append-only (a trigger refuses UPDATE and
 * DELETE, and no role holds either); they can be searched and exported, and a nightly job copies
 * each day's rows to the audit archive bucket (Object Lock at X-05).
 */

export interface AuditEntry {
  action: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

export interface RequestMeta {
  ip?: string | null;
  requestId?: string | null;
}

export async function writeAudit(tx: Tx, staff: Staff, entry: AuditEntry, meta: RequestMeta = {}): Promise<void> {
  await tx
    .insertInto('audit_logs')
    .values({
      actor_user_id: staff.identity.userId,
      actor_role: staff.level,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      before: entry.before === undefined ? null : JSON.stringify(entry.before),
      after: entry.after === undefined ? null : JSON.stringify(entry.after),
      reason: entry.reason ?? null,
      ip: meta.ip && /^[0-9a-f.:]+$/i.test(meta.ip) ? meta.ip : null,
      request_id: meta.requestId ?? null,
    })
    .execute();
}

export interface AuditQuery {
  actor?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
  before?: number;
  limit?: number;
}

export async function searchAudit(db: Database, staff: Staff, q: AuditQuery) {
  const rows = await db.withStaff({ userId: staff.identity.userId, role: dbRole(staff) }, 'admin: search the audit log', (tx) => {
    let query = tx.selectFrom('audit_logs').selectAll().orderBy('id', 'desc').limit(Math.min(q.limit ?? 100, 500));
    if (q.actor) query = query.where('actor_user_id', '=', q.actor);
    if (q.action) query = query.where('action', '=', q.action);
    if (q.targetType) query = query.where('target_type', '=', q.targetType);
    if (q.targetId) query = query.where('target_id', '=', q.targetId);
    if (q.from) query = query.where('created_at', '>=', new Date(q.from));
    if (q.to) query = query.where('created_at', '<', new Date(q.to));
    if (q.before) query = query.where('id', '<', String(q.before));
    return query.execute();
  });
  return rows.map((r) => ({
    id: Number(r.id),
    actorUserId: r.actor_user_id,
    actorRole: r.actor_role,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    before: r.before,
    after: r.after,
    reason: r.reason,
    ip: r.ip,
    requestId: r.request_id,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: Awaited<ReturnType<typeof searchAudit>>): string {
  const head = ['id', 'createdAt', 'actorUserId', 'actorRole', 'action', 'targetType', 'targetId', 'reason', 'ip', 'requestId', 'before', 'after'] as const;
  return [head.join(','), ...rows.map((r) => head.map((k) => csvCell(r[k])).join(','))].join('\n') + '\n';
}

/** The nightly copy of a day's rows to the archive bucket (idempotent: one object per day). */
export async function exportAuditDay(deps: { db: Database; storage: StoragePort; bucket: string }, day = new Date(Date.now() - 86_400_000)): Promise<number> {
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const end = new Date(start.getTime() + 86_400_000);
  const rows = await deps.db.withSystem('audit: nightly export to the archive', (tx) =>
    tx.selectFrom('audit_logs').selectAll().where('created_at', '>=', start).where('created_at', '<', end).orderBy('id').execute(),
  );
  const body = rows.map((r) => JSON.stringify({ ...r, id: String(r.id) })).join('\n') + (rows.length ? '\n' : '');
  await deps.storage.write(deps.bucket, `audit/${start.toISOString().slice(0, 10)}.jsonl`, new TextEncoder().encode(body), 'application/x-ndjson');
  return rows.length;
}
