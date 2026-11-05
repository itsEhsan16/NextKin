import { createHash } from 'node:crypto';
import { sql } from 'kysely';

import type { Database } from '../../db/database';
import { errors } from '../../http/errors';
import { writeAudit, type RequestMeta } from './audit';
import { dbRole, type Staff } from './permissions';
import { setUserStatus, type AdminUserDeps } from './users';

/**
 * Abuse reports (admin portal, Figma 407:946; toreview §171.13). Anyone holding a public shared-report
 * link (§4.1) can report it; staff settle each report with a reason: dismiss it, take the link down,
 * or suspend the link's owner (which takes the link down too). The reporter stays anonymous: nothing
 * about them is stored, and their free text is shown to staff only.
 */

export const REPORT_CATEGORIES = ['impersonation', 'spam', 'harassment', 'copyright'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export const REPORT_ACTIONS = ['dismiss', 'disable_link', 'suspend_owner'] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

/**
 * How soon a report should be settled: a policy, not a measurement, shown beside the measured median
 * (toreview §171.13 asks the owner to confirm it).
 */
export const REPORT_TARGET_HOURS = 24;
export const REPORT_LIMIT = 1000;

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');
const iso = (value: Date | string) => new Date(value).toISOString();

/** "RPT-1042", or just "1042": the report's number. */
export function reportNumber(id: string): number | null {
  const match = /^(?:RPT-)?(\d{1,12})$/i.exec(id.trim());
  return match ? Number(match[1]) : null;
}
export const reportId = (n: number | string) => `RPT-${n}`;

/** Public: report a shared link. A revoked or unknown token answers as not found, like the read. */
export async function fileReport(db: Database, token: string, input: { category: ReportCategory; reason: string }): Promise<void> {
  await db.withSystem('public: report a shared link', async (tx) => {
    const link = await tx.selectFrom('shared_reports').select(['id', 'user_id']).where('token_hash', '=', hashOf(token)).where('revoked_at', 'is', null).executeTakeFirst();
    if (!link) throw errors.notFound('report');
    await tx.insertInto('abuse_reports').values({ shared_report_id: link.id, subject_user_id: link.user_id, category: input.category, reason: input.reason.trim().slice(0, 1000) }).execute();
  });
}

export interface ReportRow {
  id: string;
  category: ReportCategory;
  item: { kind: 'public_link'; ref: string };
  receivedAt: string;
  status: 'open' | 'resolved' | 'dismissed';
  reporter: 'anonymous';
}

interface ReportRecord {
  id: string;
  category: string;
  shared_report_id: string | null;
  created_at: Date;
  status: string;
}

const toRow = (r: ReportRecord): ReportRow => ({
  id: reportId(r.id),
  category: r.category as ReportCategory,
  // A link deleted with its owner's resume leaves the report; the ref then names the report itself.
  item: { kind: 'public_link', ref: r.shared_report_id ?? reportId(r.id) },
  receivedAt: iso(r.created_at),
  status: r.status as ReportRow['status'],
  reporter: 'anonymous',
});

const staffDb = (staff: Staff) => ({ userId: staff.identity.userId, role: dbRole(staff) });

export async function listReports(db: Database, staff: Staff): Promise<{ rows: ReportRow[]; capped: boolean }> {
  const records = await db.withStaff(staffDb(staff), 'admin: abuse reports', (tx) =>
    tx.selectFrom('abuse_reports').select(['id', 'category', 'shared_report_id', 'created_at', 'status']).orderBy('created_at', 'desc').limit(REPORT_LIMIT + 1).execute(),
  );
  return { rows: records.slice(0, REPORT_LIMIT).map(toRow), capped: records.length > REPORT_LIMIT };
}

export interface ReportStatsWire {
  open: number;
  oldestOpenAt: string | null;
  resolved30d: number;
  /** How the last thirty days' reports were settled. */
  settled30d: { dismissed: number; linksDisabled: number; suspensions: number };
  /** Median hours from receipt to settlement over the last thirty days; null when none was settled. */
  medianResolveHours: number | null;
  targetHours: number;
}

export async function reportStats(db: Database, staff: Staff): Promise<ReportStatsWire> {
  return db.withStaff(staffDb(staff), 'admin: abuse-report figures', async (tx) => {
    const open = await sql<{ n: number; oldest: Date | null }>`select count(*)::int as n, min(created_at) as oldest from app.abuse_reports where status = 'open'`.execute(tx);
    const settled = await sql<{ n: number; dismissed: number; disabled: number; suspended: number; median: number | null }>`
      select count(*)::int as n,
             count(*) filter (where action = 'dismiss')::int as dismissed,
             count(*) filter (where action = 'disable_link')::int as disabled,
             count(*) filter (where action = 'suspend_owner')::int as suspended,
             percentile_cont(0.5) within group (order by extract(epoch from acted_at - created_at) / 3600) as median
      from app.abuse_reports where status <> 'open' and acted_at > now() - interval '30 days'`.execute(tx);
    const o = open.rows[0];
    const s = settled.rows[0];
    return {
      open: o?.n ?? 0,
      oldestOpenAt: o?.oldest ? iso(o.oldest) : null,
      resolved30d: s?.n ?? 0,
      settled30d: { dismissed: s?.dismissed ?? 0, linksDisabled: s?.disabled ?? 0, suspensions: s?.suspended ?? 0 },
      medianResolveHours: s?.median === null || s?.median === undefined ? null : Math.round(Number(s.median) * 10) / 10,
      targetHours: REPORT_TARGET_HOURS,
    };
  });
}

export interface ReportDetailWire extends ReportRow {
  reason: string;
  ownerRef: string;
  linkCreatedAt: string | null;
  /** Shared links don't count their views: always null, never a guess. */
  views: null;
  prior: { count: number; latestAt: string } | null;
  outcome: { action: ReportAction; reason: string; note: string; at: string } | null;
}

export async function reportDetail(db: Database, staff: Staff, id: string): Promise<ReportDetailWire> {
  const n = reportNumber(id);
  if (n === null) throw errors.notFound('report');
  return db.withStaff(staffDb(staff), 'admin: an abuse report', async (tx) => {
    const r = await tx.selectFrom('abuse_reports').selectAll().where('id', '=', String(n)).executeTakeFirst();
    if (!r) throw errors.notFound('report');
    const link = r.shared_report_id ? await tx.selectFrom('shared_reports').select('created_at').where('id', '=', r.shared_report_id).executeTakeFirst() : undefined;
    // Earlier reports against anything the same owner shared.
    const prior = r.subject_user_id
      ? await tx.selectFrom('abuse_reports').select([sql<number>`count(*)::int`.as('n'), sql<Date | null>`max(created_at)`.as('latest')]).where('subject_user_id', '=', r.subject_user_id).where('id', '<>', r.id).where('created_at', '<', r.created_at).executeTakeFirstOrThrow()
      : { n: 0, latest: null };
    return {
      ...toRow({ id: String(r.id), category: r.category, shared_report_id: r.shared_report_id, created_at: r.created_at, status: r.status }),
      reason: r.reason,
      ownerRef: r.subject_user_id ?? '',
      linkCreatedAt: link ? iso(link.created_at) : null,
      views: null,
      prior: prior.n > 0 && prior.latest ? { count: prior.n, latestAt: iso(prior.latest) } : null,
      outcome: r.action && r.acted_at ? { action: r.action as ReportAction, reason: r.action_reason ?? '', note: r.action_note ?? '', at: iso(r.acted_at) } : null,
    };
  });
}

/**
 * Settles an open report. Suspending the owner goes through the users service (it ends their
 * sessions and audits itself), then the report and its link are settled and audited together.
 */
export async function actOnReport(deps: AdminUserDeps, staff: Staff, id: string, input: { action: ReportAction; reason: string; note: string }, meta: RequestMeta): Promise<ReportDetailWire> {
  const n = reportNumber(id);
  if (n === null) throw errors.notFound('report');
  const { db } = deps;
  const current = await db.withSystem(`admin ${staff.identity.userId}: read an abuse report`, (tx) => tx.selectFrom('abuse_reports').select(['status', 'subject_user_id', 'shared_report_id']).where('id', '=', String(n)).executeTakeFirst());
  if (!current) throw errors.notFound('report');
  if (current.status !== 'open') throw errors.conflict('This report has already been settled.');
  if (input.action === 'suspend_owner') {
    if (!current.subject_user_id) throw errors.conflict('The link’s owner no longer has an account.');
    await setUserStatus(deps, staff, current.subject_user_id, 'suspended', 'abuse', `${reportId(n)}: ${input.reason}${input.note ? ` (${input.note})` : ''}`.slice(0, 900), meta);
  }
  await db.withSystem(`admin ${staff.identity.userId}: settle an abuse report`, async (tx) => {
    const locked = await tx.selectFrom('abuse_reports').select('status').where('id', '=', String(n)).forUpdate().executeTakeFirst();
    if (!locked || locked.status !== 'open') throw errors.conflict('This report has already been settled.');
    const takeDown = input.action !== 'dismiss' && current.shared_report_id;
    if (takeDown) await tx.updateTable('shared_reports').set({ revoked_at: sql`now()` }).where('id', '=', current.shared_report_id!).where('revoked_at', 'is', null).execute();
    await tx
      .updateTable('abuse_reports')
      .set({ status: input.action === 'dismiss' ? 'dismissed' : 'resolved', action: input.action, action_reason: input.reason.slice(0, 100), action_note: input.note.slice(0, 1000), acted_by: staff.identity.userId, acted_at: sql`now()` })
      .where('id', '=', String(n))
      .execute();
    await writeAudit(tx, staff, { action: `abuse_report.${input.action}`, targetType: 'abuse_report', targetId: reportId(n), before: { status: 'open' }, after: { action: input.action, linkDisabled: Boolean(takeDown), ...(current.subject_user_id ? { userId: current.subject_user_id } : {}) }, reason: [input.reason, input.note].filter(Boolean).join(': ').slice(0, 1000) }, meta);
  });
  return reportDetail(db, staff, String(n));
}
