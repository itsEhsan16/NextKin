import { z } from 'zod';

import type {
  AbuseReport,
  AbuseReportDetail,
  FailureDetail,
  FailureFilter,
  FailurePage,
  FailureQuery,
  FailureStats,
  GenerationFailure,
  ReportCategory,
  ReportFilter,
  ReportPage,
  ReportStats,
} from '../../models/adminTrust';
import { FAILURE_KIND_LABEL, REPORT_CATEGORY_LABEL } from '../../models/adminTrust';
import {
  FAILURES_PAGE_SIZE,
  matchesFailure,
  matchesReport,
  REPORTS_PAGE_SIZE,
  tailOf,
  toCsv,
} from '../adminTrustRepo';
import type { HttpClient } from './client';

/**
 * Generation failures and abuse reports over `/api/v1/admin/failures*` and `/admin/reports*`
 * (`packages/server/src/services/admin/trustFailures.ts`, `trustReports.ts`). The server answers each
 * list whole (capped at 1,000 and flagged when it is), and this side filters, counts, pages and
 * writes the CSV with the mock's own functions, so the two sources page and search alike. The
 * captions ("oldest 2 h ago") are written here from the times the server reports.
 */

const FAILURE_KINDS = ['tailor', 'resume_build', 'cover_letter', 'ats_check', 'interview'] as const;

const failureRow = z.object({
  id: z.string(),
  kind: z.enum(FAILURE_KINDS),
  stage: z.string(),
  errorCode: z.string(),
  userRef: z.string(),
  attempts: z.number(),
  maxAttempts: z.number(),
  failedAt: z.string(),
  status: z.enum(['open', 'retrying', 'resolved']),
});

export const failureListSchema = z.object({ data: z.array(failureRow), capped: z.boolean() });

export const failureStatsSchema = z.object({
  failed30d: z.number(),
  totalRuns30d: z.number(),
  open: z.number(),
  oldestOpenAt: z.string().nullable(),
  openRetriesUsedUp: z.boolean(),
  retried30d: z.number(),
  retriedOk30d: z.number(),
  mostCommon: z.object({ errorCode: z.string(), stage: z.string(), runs: z.number() }).nullable(),
  capped: z.boolean(),
});

export const failureDetailSchema = failureRow.extend({
  stages: z.array(
    z.object({
      name: z.string(),
      outcome: z.enum(['done', 'failed', 'skipped']),
      detail: z.string(),
      seconds: z.number().optional(),
    }),
  ),
  error: z.object({
    message: z.string(),
    requestRef: z.string().nullable(),
    retryPolicy: z.string(),
  }),
  prompt: z
    .object({ name: z.string(), version: z.number(), publishedAt: z.string().nullable() })
    .nullable(),
  model: z.string().nullable(),
  tokensIn: z.number(),
  tokensOut: z.number(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});

export const retryOutcomeSchema = z.object({
  retried: z.array(z.string()),
  skipped: z.array(z.object({ id: z.string(), reason: z.string() })),
});

const REPORT_CATEGORIES = ['impersonation', 'spam', 'harassment', 'copyright'] as const;
const reportRow = z.object({
  id: z.string(),
  category: z.enum(REPORT_CATEGORIES),
  item: z.object({ kind: z.enum(['public_link', 'shared_resume']), ref: z.string() }),
  receivedAt: z.string(),
  status: z.enum(['open', 'resolved', 'dismissed']),
  reporter: z.literal('anonymous'),
});

export const reportListSchema = z.object({ data: z.array(reportRow), capped: z.boolean() });

export const reportStatsSchema = z.object({
  open: z.number(),
  oldestOpenAt: z.string().nullable(),
  resolved30d: z.number(),
  settled30d: z.object({
    dismissed: z.number(),
    linksDisabled: z.number(),
    suspensions: z.number(),
  }),
  medianResolveHours: z.number().nullable(),
  targetHours: z.number(),
});

export const reportDetailSchema = reportRow.extend({
  reason: z.string(),
  ownerRef: z.string(),
  linkCreatedAt: z.string().nullable(),
  views: z.number().nullable(),
  prior: z.object({ count: z.number(), latestAt: z.string() }).nullable(),
  outcome: z
    .object({
      action: z.enum(['dismiss', 'disable_link', 'suspend_owner']),
      reason: z.string(),
      note: z.string(),
      at: z.string(),
    })
    .nullable(),
});

/** What an error code reads as on the cards and in the drawer; an unknown code reads as itself. */
const ERROR_LABEL: Record<string, string> = {
  timed_out: 'Timed out',
  provider: 'Provider error',
  dead_lettered: 'Retries used up',
  invalid: 'Invalid request',
};
export const errorLabel = (code: string) =>
  ERROR_LABEL[code] ??
  code.replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase());

/** "2 h", "35 min", "3 d": how long ago, in the boards' captions. */
export function ago(at: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - new Date(at).getTime()) / 60_000));
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function toFailureStats(raw: unknown, now = Date.now()): FailureStats {
  const s = failureStatsSchema.parse(raw);
  const usedUp = s.openRetriesUsedUp ? ' · retries used up' : '';
  return {
    failed30d: s.failed30d,
    failedRate: s.totalRuns30d > 0 ? s.failed30d / s.totalRuns30d : 0,
    totalRuns: s.totalRuns30d,
    open: s.open,
    openNote:
      s.open > 0 && s.oldestOpenAt
        ? `oldest ${ago(s.oldestOpenAt, now)} ago${usedUp}`
        : 'nothing waiting',
    retriedOk: s.retriedOk30d,
    retriedOkRate: s.retried30d > 0 ? s.retriedOk30d / s.retried30d : 0,
    mostCommon: s.mostCommon
      ? { label: errorLabel(s.mostCommon.errorCode), stage: s.mostCommon.stage, runs: s.mostCommon.runs }
      : null,
  };
}

const pageOf = <T>(rows: T[], page: number, size: number) => {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const at = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((at - 1) * size, at * size), pages };
};

const filteredFailures = (rows: GenerationFailure[], query: FailureQuery) =>
  rows.filter(
    (row) => matchesFailure(row, query) && (query.status === 'all' || row.status === query.status),
  );

export function toFailurePage(raw: unknown, query: FailureQuery): FailurePage {
  const { data } = failureListSchema.parse(raw);
  const matching = data.filter((row) => matchesFailure(row, query));
  const counts: Record<FailureFilter, number> = {
    open: matching.filter((row) => row.status === 'open').length,
    retrying: matching.filter((row) => row.status === 'retrying').length,
    resolved: matching.filter((row) => row.status === 'resolved').length,
    all: matching.length,
  };
  const rows = filteredFailures(data, query);
  const { rows: page, pages } = pageOf(rows, query.page, FAILURES_PAGE_SIZE);
  return { rows: page, total: rows.length, pages, counts };
}

export function failuresCsv(raw: unknown, query: FailureQuery): string {
  const { data } = failureListSchema.parse(raw);
  return toCsv([
    ['run', 'kind', 'stage', 'error_code', 'user', 'attempts', 'failed_at', 'status'],
    ...filteredFailures(data, query).map((row) => [
      `run ···${tailOf(row.id)}`,
      FAILURE_KIND_LABEL[row.kind],
      row.stage,
      row.errorCode,
      `user ···${tailOf(row.userRef)}`,
      `${row.attempts} of ${row.maxAttempts}`,
      row.failedAt,
      row.status,
    ]),
  ]);
}

export function toFailureDetail(raw: unknown): FailureDetail {
  const d = failureDetailSchema.parse(raw);
  return {
    ...d,
    stages: d.stages.map((stage) => ({
      name: stage.name,
      outcome: stage.outcome,
      detail: stage.detail,
      ...(stage.seconds !== undefined ? { seconds: stage.seconds } : {}),
      ...(stage.outcome === 'failed' ? { label: errorLabel(d.errorCode) } : {}),
    })),
  };
}

/** Why a staff retry didn't go ahead, in words; `null` for a run that simply wasn't open. */
const SKIP_REASON: Record<string, string | null> = {
  quota: 'the user is at their plan’s limit',
  not_failed: 'it is no longer a failed run',
  error: 'the server couldn’t queue it',
  not_found: 'it is no longer in the queue',
  retrying: null,
  resolved: null,
};

/**
 * The retry's outcome as the screen needs it: runs that weren't open are skipped silently (the
 * screen counts them), anything else that couldn't be retried is an error saying why.
 */
export function checkRetry(raw: unknown): void {
  const outcome = retryOutcomeSchema.parse(raw);
  const failed = outcome.skipped.filter((skip) => SKIP_REASON[skip.reason] !== null);
  if (failed.length === 0) return;
  const reasons = [...new Set(failed.map((skip) => SKIP_REASON[skip.reason] ?? skip.reason))];
  const head =
    outcome.retried.length > 0
      ? `Retried ${plural(outcome.retried.length, 'run')}; ${plural(failed.length, 'run')} couldn’t be`
      : failed.length === 1
        ? 'That run couldn’t be retried'
        : `${plural(failed.length, 'run')} couldn’t be retried`;
  throw new Error(`${head}: ${reasons.join('; ')}.`);
}

// --- Abuse reports -----------------------------------------------------------------------------

export function toReportStats(raw: unknown, now = Date.now()): ReportStats {
  const s = reportStatsSchema.parse(raw);
  const { dismissed, linksDisabled, suspensions } = s.settled30d;
  const parts = [
    dismissed > 0 ? `${dismissed} dismissed` : null,
    linksDisabled > 0 ? plural(linksDisabled, 'link') + ' disabled' : null,
    suspensions > 0 ? plural(suspensions, 'suspension') : null,
  ].filter(Boolean);
  return {
    open: s.open,
    openNote:
      s.open > 0 && s.oldestOpenAt
        ? `oldest received ${ago(s.oldestOpenAt, now)} ago`
        : 'nothing waiting',
    resolved30d: s.resolved30d,
    resolvedNote: parts.length > 0 ? parts.join(' · ') : 'none in the last 30 days',
    medianResolveHours: s.medianResolveHours,
    targetHours: s.targetHours,
  };
}

const filteredReports = (
  rows: AbuseReport[],
  filter: ReportFilter,
  search: string,
  categories: ReportCategory[],
) =>
  rows.filter(
    (row) =>
      matchesReport(row, search, categories) &&
      (filter === 'all' || (filter === 'open' ? row.status === 'open' : row.status !== 'open')),
  );

export function toReportPage(
  raw: unknown,
  filter: ReportFilter,
  search: string,
  page: number,
  categories: ReportCategory[] = [],
): ReportPage {
  const { data } = reportListSchema.parse(raw);
  const matching = data.filter((row) => matchesReport(row, search, categories));
  const rows = filteredReports(data, filter, search, categories);
  const { rows: slice, pages } = pageOf(rows, page, REPORTS_PAGE_SIZE);
  return {
    rows: slice,
    total: rows.length,
    pages,
    counts: {
      open: matching.filter((row) => row.status === 'open').length,
      resolved: matching.filter((row) => row.status !== 'open').length,
      all: matching.length,
    },
  };
}

export function reportsCsv(
  raw: unknown,
  filter: ReportFilter,
  search: string,
  categories: ReportCategory[] = [],
): string {
  const { data } = reportListSchema.parse(raw);
  return toCsv([
    ['report', 'category', 'item', 'item_kind', 'reporter', 'received', 'status'],
    ...filteredReports(data, filter, search, categories).map((row) => [
      row.id,
      REPORT_CATEGORY_LABEL[row.category],
      `${row.item.kind === 'public_link' ? 'link' : 'resume'} ···${tailOf(row.item.ref)}`,
      row.item.kind === 'public_link' ? 'Public link' : 'Shared resume',
      'Anonymous',
      row.receivedAt,
      row.status,
    ]),
  ]);
}

export function toReportDetail(raw: unknown, now = Date.now()): AbuseReportDetail {
  const d = reportDetailSchema.parse(raw);
  return {
    id: d.id,
    category: d.category,
    item: d.item,
    receivedAt: d.receivedAt,
    status: d.status,
    reporter: d.reporter,
    reason: d.reason,
    ownerRef: d.ownerRef,
    linkCreatedAt: d.linkCreatedAt,
    views: d.views,
    prior: d.prior
      ? {
          count: d.prior.count,
          note: `against this owner, latest ${ago(d.prior.latestAt, now)} ago`,
        }
      : null,
    outcome: d.outcome,
  };
}

/** The repository's failure and report methods over the client. */
export function createTrustOps(http: HttpClient) {
  const failureList = () => http.request('/admin/failures');
  const reportList = () => http.request('/admin/reports');
  return {
    failureStats: async () => toFailureStats(await http.request('/admin/failures/stats')),
    failures: async (query: FailureQuery) => toFailurePage(await failureList(), query),
    failureDetail: async (id: string) =>
      toFailureDetail(await http.request(`/admin/failures/${encodeURIComponent(id)}`)),
    retryFailures: async (ids: string[]) => {
      if (ids.length === 0) return;
      checkRetry(
        await http.request('/admin/failures/retry', { method: 'POST', body: { ids } }),
      );
    },
    resolveFailure: async (id: string) => {
      await http.request(`/admin/failures/${encodeURIComponent(id)}/resolve`, { method: 'POST' });
    },
    exportFailures: async (query: FailureQuery) => failuresCsv(await failureList(), query),

    reportStats: async () => toReportStats(await http.request('/admin/reports/stats')),
    reports: async (
      filter: ReportFilter,
      search: string,
      page: number,
      categories: ReportCategory[] = [],
    ) => toReportPage(await reportList(), filter, search, page, categories),
    report: async (id: string) =>
      toReportDetail(await http.request(`/admin/reports/${encodeURIComponent(id)}`)),
    actOnReport: async (
      id: string,
      input: { action: 'dismiss' | 'disable_link' | 'suspend_owner'; reason: string; note: string },
    ) =>
      toReportDetail(
        await http.request(`/admin/reports/${encodeURIComponent(id)}/action`, {
          method: 'POST',
          body: input,
        }),
      ),
    exportReports: async (filter: ReportFilter, search: string, categories: ReportCategory[] = []) =>
      reportsCsv(await reportList(), filter, search, categories),
  };
}
