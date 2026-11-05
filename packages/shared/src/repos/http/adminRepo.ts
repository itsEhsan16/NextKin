import type { AdminActivity, AdminQueue, AdminRole } from '../../models/admin';
import {
  adminAuditSchema,
  adminKbQueueSchema,
  adminMeSchema,
  adminProfileSchema,
  adminPromptsSchema,
} from '../../schemas/admin';
import { matchesActivity } from '../adminRepo';
import { NotFoundError } from '../state';
import type { AdminRepo } from '../types';
import { createHttpAdminPeopleRepo } from './adminPeopleRepo';
import { createHttpAdminTrustRepo } from './adminTrustRepo';
import { ApiError, type HttpClient } from './client';
import { fetchStaffNames } from './adminStaffOps';
import { providerLabel, toOverview } from './adminOverviewWire';

const STAFF_ROLES = new Set<string>(['support', 'curator', 'admin', 'super_admin']);

/** At or above this error rate today a provider is a queue item (the Overview's amber, 396:684). */
const PROVIDER_ERROR_RATE = 0.01;

const DAY_MS = 24 * 60 * 60 * 1000;

type PromptRows = ReturnType<typeof adminPromptsSchema.parse>['data'];

/**
 * Prompts whose draft still needs a passing eval before it can publish: a stage's draft is its
 * newest draft or staged version, as the AI prompts page reads it (`toStage` in
 * `http/adminContentRepo.ts`), so the two pages count the same drafts.
 */
const awaitingEval = (prompts: PromptRows) =>
  prompts.filter((prompt) => {
    const draft = prompt.versions
      .filter((version) => version.status === 'draft' || version.status === 'staged')
      .sort((a, b) => b.version - a.version)[0];
    return draft !== undefined && draft.evaluated !== true;
  }).length;

/**
 * Enabled providers at or above the error line today (`/admin/providers/stats`, counted per call
 * since migration 0054); the worst one names the queue's line. A provider with no calls today has
 * no rate and isn't counted.
 */
async function erroringProviders(http: HttpClient): Promise<AdminQueue> {
  const [list, stats] = await Promise.all([
    http.request('/admin/providers') as Promise<{ data: { provider: string; enabled: boolean }[] }>,
    http.request('/admin/providers/stats') as Promise<Record<string, { errorRate: number | null }>>,
  ]);
  const erroring = list.data
    .filter((p) => p.enabled)
    .map((p) => ({ provider: p.provider, rate: stats[p.provider]?.errorRate ?? null }))
    .filter((p): p is { provider: string; rate: number } => p.rate !== null && p.rate >= PROVIDER_ERROR_RATE)
    .sort((a, b) => b.rate - a.rate);
  const worst = erroring[0];
  return {
    key: 'providerErrors',
    count: erroring.length,
    detail: worst
      ? `${providerLabel(worst.provider)} at ${(worst.rate * 100).toFixed(1)}% errors today`
      : 'No provider above 1% errors today',
  };
}

/**
 * A queue the role can't open (403), the server doesn't serve yet (`UNAVAILABLE`, 404) or answers
 * `null` for is left out.
 */
const optional = <T>(request: Promise<T | null>): Promise<T | null> =>
  request.catch((error: unknown) => {
    if (error instanceof NotFoundError) return null;
    if (error instanceof ApiError && (error.status === 403 || error.code === 'UNAVAILABLE')) return null;
    throw error;
  });

/** A 403 means the role can't open that queue (support reads neither); it isn't shown. */
const unlessForbidden = <T>(request: Promise<T>): Promise<T | null> =>
  request.catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 403) return null;
    throw error;
  });

type AuditRow = ReturnType<typeof adminAuditSchema.parse>['data'][number];

/**
 * What a row was done to, in the Overview's three kinds. A content read targets the resume, and its
 * `after` names whose it is, which is what the board's row shows (`user ···9c10`).
 */
function targetOf(row: AuditRow): AdminActivity['target'] {
  if (row.targetType === 'technology' || row.targetType === 'prompt') {
    return { kind: row.targetType, ref: row.targetId ?? '' };
  }
  if (row.targetType === 'resume') {
    const owner = (row.after as { userId?: unknown } | null | undefined)?.userId;
    if (typeof owner === 'string') return { kind: 'user', ref: owner };
  }
  return { kind: 'user', ref: row.targetId ?? '' };
}

/**
 * `AdminRepo` over `/api/v1/admin/*` (P12-01…P12-05). Staff only: a user session gets 403 here.
 *
 * The Overview is `GET /admin/overview` (`adminOverviewWire.ts`). The queues are counted from each
 * area's own stats, through that area's repository, so the Overview and the area agree; a queue the
 * role can't open, or the server doesn't serve, is left out rather than sent as a zero.
 */
export function createHttpAdminRepo(http: HttpClient): AdminRepo {
  return {
    me: async () => {
      const [access, profile] = await Promise.all([
        http.request('/admin/me').then((raw) => adminMeSchema.parse(raw)),
        http.request('/me').then((raw) => adminProfileSchema.parse(raw)),
      ]);
      const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email;
      return { userId: profile.id, name, email: profile.email, ...access };
    },

    overview: async (range) => toOverview(await http.request('/admin/overview', { query: { range } }), range),

    queues: async () => {
      const trust = createHttpAdminTrustRepo(http);
      const people = createHttpAdminPeopleRepo(http);
      const [failures, kb, deletions, reports, prompts, providers] = await Promise.all([
        optional(trust.failureStats()),
        unlessForbidden(
          http.request('/admin/kb/queue').then((raw) => adminKbQueueSchema.parse(raw)),
        ),
        optional(people.deletionStats()),
        optional(trust.reportStats()),
        unlessForbidden(
          http.request('/admin/prompts').then((raw) => adminPromptsSchema.parse(raw)),
        ),
        optional(erroringProviders(http)),
      ]);
      const queues: AdminQueue[] = [];
      if (failures) {
        const detail = failures.openNote || 'Runs waiting for a retry or a fix';
        queues.push({ key: 'generationFailures', count: failures.open, detail });
      }
      // The review queue alone, as the KB page counts it: users' reports are a list of their own.
      if (kb) {
        const count = kb.candidates.length;
        queues.push({ key: 'kbReview', count, detail: 'Diffs waiting for approve or reject' });
      }
      if (deletions) {
        const days = deletions.nextDueAt
          ? Math.max(0, Math.ceil((Date.parse(deletions.nextDueAt) - Date.now()) / DAY_MS))
          : null;
        const detail =
          deletions.overdue > 0
            ? `${deletions.overdue} past the 30-day limit`
            : days === null
              ? 'Within the 30-day limit'
              : `Next due in ${days} days (30-day limit)`;
        queues.push({ key: 'deletionRequests', count: deletions.open, detail });
      }
      if (reports) {
        const detail = reports.openNote || 'Reported resumes and misuse';
        queues.push({ key: 'abuseReports', count: reports.open, detail });
      }
      if (prompts) {
        const count = awaitingEval(prompts.data);
        queues.push({ key: 'promptDrafts', count, detail: 'Need a passing eval to publish' });
      }
      if (providers) queues.push(providers);
      return queues;
    },

    activity: async (query) => {
      const [{ data }, names] = await Promise.all([
        http.request('/admin/audit', { query: { limit: 50 } }).then((raw) => adminAuditSchema.parse(raw)),
        fetchStaffNames(http).catch((): Record<string, string> => ({})),
      ]);
      const rows: AdminActivity[] = data.map((row) => ({
        id: String(row.id),
        // Named from `/admin/staff/names` (toreview §171.13); an unknown id stays masked.
        staff: {
          name: row.actorUserId
            ? (names[row.actorUserId] ?? `staff ···${row.actorUserId.slice(-4)}`)
            : 'System',
          role: (STAFF_ROLES.has(row.actorRole ?? '') ? row.actorRole : 'support') as AdminRole,
        },
        action: row.action,
        target: targetOf(row),
        reason: row.reason ?? '',
        result:
          row.action === 'user.content_read'
            ? 'audited_read'
            : row.action === 'user.suspend'
              ? 'suspended'
              : 'done',
        at: row.createdAt,
      }));
      return rows.filter((row) => matchesActivity(row, query)).slice(0, 5);
    },
  };
}
