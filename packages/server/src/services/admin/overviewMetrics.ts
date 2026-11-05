import { sql } from 'kysely';

import type { Tx } from '../../db/database';

/**
 * The admin portal's headline metrics, as V2 §2.2 defines them, read from the tables that record
 * what happened (not usage events, so "Share anonymized data" switched off still counts). Shared by
 * the Overview (`overview.ts`) and the Analytics page (`businessAnalytics.ts`). Aggregate only:
 * counts, rates and sums; nobody is named. Staff accounts never count (`role = 'user'`).
 *
 * A window is whole UTC days ending today (today is partial): 7, 30 or 90 of them. The previous
 * window is the same number of days just before it.
 */

export type MetricRange = '7d' | '30d' | '90d';
export const RANGE_DAYS: Record<MetricRange, number> = { '7d': 7, '30d': 30, '90d': 90 };
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Window {
  from: Date;
  to: Date;
  /** The UTC dates in the window, oldest first, as YYYY-MM-DD. */
  days: string[];
}

export function windowsFor(range: MetricRange, now = new Date()): { current: Window; previous: Window; now: Date } {
  const n = RANGE_DAYS[range];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const from = new Date(today - (n - 1) * DAY_MS);
  const prevFrom = new Date(from.getTime() - n * DAY_MS);
  return { current: { from, to: now, days: datesFrom(from, n) }, previous: { from: prevFrom, to: from, days: datesFrom(prevFrom, n) }, now };
}

export function datesFrom(from: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) => new Date(from.getTime() + i * DAY_MS).toISOString().slice(0, 10));
}

/** A rate over its cohort, and the rate per day (only days with a cohort: an empty day has no rate). */
export interface DailyRate {
  cohort: number;
  hit: number;
  rate: number | null;
  trend: number[];
}

type DayRow = { day: string; cohort: number; hit: number };

function dailyRate(rows: DayRow[]): DailyRate {
  const cohort = rows.reduce((sum, row) => sum + Number(row.cohort), 0);
  const hit = rows.reduce((sum, row) => sum + Number(row.hit), 0);
  return {
    cohort,
    hit,
    rate: cohort ? hit / cohort : null,
    trend: rows.filter((row) => Number(row.cohort) > 0).map((row) => Number(row.hit) / Number(row.cohort)),
  };
}

/** Counts per UTC day, with the days that had none filled in as 0. */
export function fillDays(days: string[], rows: { day: string; n: number }[]): number[] {
  const byDay = new Map(rows.map((row) => [row.day, Number(row.n)]));
  return days.map((day) => byDay.get(day) ?? 0);
}

/** Sign-ups: user accounts created in the window, per day. */
export async function signups(tx: Tx, w: Window): Promise<{ total: number; trend: number[] }> {
  const { rows } = await sql<{ day: string; n: number }>`
    SELECT (created_at AT TIME ZONE 'utc')::date::text AS day, count(*)::int AS n
    FROM app.users WHERE role = 'user' AND created_at >= ${w.from} AND created_at < ${w.to}
    GROUP BY 1`.execute(tx);
  const trend = fillDays(w.days, rows);
  return { total: trend.reduce((sum, n) => sum + n, 0), trend };
}

/**
 * Activation (V2 §2.2): of the people who signed up in the window, the share who finished their
 * first resume (any mode: built, tailored or Zero Resume) within 72 hours. Only sign-ups whose 72
 * hours are over count, so the rate is final, never one that can still rise.
 */
export async function activation(tx: Tx, w: Window, now: Date): Promise<DailyRate> {
  const { rows } = await sql<DayRow>`
    SELECT (u.created_at AT TIME ZONE 'utc')::date::text AS day, count(*)::int AS cohort,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM app.generations g
             WHERE g.user_id = u.id AND g.status = 'ready' AND g.kind IN ('resume', 'zero_resume')
               AND g.finished_at <= u.created_at + interval '72 hours'))::int AS hit
    FROM app.users u
    WHERE u.role = 'user' AND u.created_at >= ${w.from} AND u.created_at < ${w.to}
      AND u.created_at <= ${now}::timestamptz - interval '72 hours'
    GROUP BY 1 ORDER BY 1`.execute(tx);
  return dailyRate(rows);
}

/**
 * Generation reliability (V2 §2.2): of the runs started in the window that have finished, the share
 * that came out ready without anyone pressing retry (`generations.manual_retries`, migration 0054).
 * Runs still in flight don't count yet.
 */
export async function reliability(tx: Tx, w: Window): Promise<DailyRate> {
  const { rows } = await sql<DayRow>`
    SELECT (created_at AT TIME ZONE 'utc')::date::text AS day, count(*)::int AS cohort,
           count(*) FILTER (WHERE status = 'ready' AND manual_retries = 0)::int AS hit
    FROM app.generations
    WHERE created_at >= ${w.from} AND created_at < ${w.to} AND status IN ('ready', 'failed')
    GROUP BY 1 ORDER BY 1`.execute(tx);
  return dailyRate(rows);
}

/**
 * Free-to-paid conversion (V2 §2.2): of the people who activated, the share who started a paid Pro
 * subscription (one the gateway bills; a staff comp isn't one) within 30 days of activating. The
 * cohort is everyone who activated in the window shifted back 30 days, so each person has had all
 * 30 days and the rate is final. A platform younger than 30 days has no cohort yet.
 */
export async function conversion(tx: Tx, w: Window): Promise<DailyRate> {
  const { rows } = await sql<DayRow>`
    WITH activated AS (
      SELECT u.id, min(g.finished_at) AS at
      FROM app.users u JOIN app.generations g ON g.user_id = u.id
      WHERE u.role = 'user' AND g.status = 'ready' AND g.kind IN ('resume', 'zero_resume')
        AND g.finished_at <= u.created_at + interval '72 hours'
      GROUP BY u.id
    )
    SELECT (a.at AT TIME ZONE 'utc')::date::text AS day, count(*)::int AS cohort,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM app.subscriptions s
             WHERE s.user_id = a.id AND s.plan_id LIKE 'pro%' AND s.gateway_subscription_id IS NOT NULL
               AND s.created_at >= a.at AND s.created_at <= a.at + interval '30 days'))::int AS hit
    FROM activated a
    WHERE a.at >= ${w.from}::timestamptz - interval '30 days' AND a.at < ${w.to}::timestamptz - interval '30 days'
    GROUP BY 1 ORDER BY 1`.execute(tx);
  return dailyRate(rows);
}

/** The Overview's five kinds: a tailored run is a resume run carrying its tailoring (`services/generations.ts`). */
export const ADMIN_KIND_SQL = sql<string>`CASE
  WHEN kind = 'resume' AND input ? 'tailor' THEN 'tailor'
  WHEN kind IN ('resume', 'zero_resume', 'section') THEN 'resume'
  ELSE kind END`;

/** Runs and failures by the Overview's kinds in a window. */
export async function runsByKind(tx: Tx, w: Window): Promise<{ kind: string; runs: number; failed: number }[]> {
  const { rows } = await sql<{ kind: string; runs: number; failed: number }>`
    SELECT ${ADMIN_KIND_SQL} AS kind, count(*)::int AS runs, count(*) FILTER (WHERE status = 'failed')::int AS failed
    FROM app.generations WHERE created_at >= ${w.from} AND created_at < ${w.to}
    GROUP BY 1`.execute(tx);
  return rows.map((row) => ({ kind: row.kind, runs: Number(row.runs), failed: Number(row.failed) }));
}

/**
 * Seconds from a run being asked for to its end, over runs started in the window that nobody
 * retried by hand (a retried run's clock restarts, so its time isn't one wait). `ready` only for
 * how long a finished document takes; ready and failed for the 3-minute terminal-state SLA (§9).
 */
export async function runTimes(tx: Tx, w: Window, slaSeconds: number): Promise<{ p95Ready: number | null; p95Terminal: number | null; terminal: number; withinSla: number }> {
  const row = await sql<{ p95_ready: number | null; p95_terminal: number | null; terminal: number; within: number }>`
    SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM finished_at - created_at)) FILTER (WHERE status = 'ready') AS p95_ready,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM finished_at - created_at)) AS p95_terminal,
           count(*)::int AS terminal,
           count(*) FILTER (WHERE finished_at - created_at <= make_interval(secs => ${slaSeconds}::int))::int AS within
    FROM app.generations
    WHERE created_at >= ${w.from} AND created_at < ${w.to} AND status IN ('ready', 'failed')
      AND finished_at IS NOT NULL AND manual_retries = 0`.execute(tx);
  const r = row.rows[0];
  const round = (value: number | null | undefined) => (value === null || value === undefined ? null : Math.round(Number(value)));
  return { p95Ready: round(r?.p95_ready), p95Terminal: round(r?.p95_terminal), terminal: Number(r?.terminal ?? 0), withinSla: Number(r?.within ?? 0) };
}

/** ATS checks scored in the window: the mean and median of the total (0–100), and ten-point buckets. */
export async function atsScores(tx: Tx, w: Window): Promise<{ mean: number | null; median: number | null; buckets: { from: number; to: number; count: number }[] }> {
  const stats = await sql<{ mean: number | null; median: number | null }>`
    SELECT avg(total_bps) / 100.0 AS mean, percentile_cont(0.5) WITHIN GROUP (ORDER BY total_bps) / 100.0 AS median
    FROM app.ats_reports WHERE total_bps IS NOT NULL AND created_at >= ${w.from} AND created_at < ${w.to}`.execute(tx);
  // A perfect 100 joins the 90–100 bucket.
  const { rows } = await sql<{ bucket: number; n: number }>`
    SELECT least(floor(total_bps / 1000.0), 9)::int AS bucket, count(*)::int AS n
    FROM app.ats_reports WHERE total_bps IS NOT NULL AND total_bps >= 0 AND created_at >= ${w.from} AND created_at < ${w.to}
    GROUP BY 1`.execute(tx);
  const one = (value: number | null | undefined) => (value === null || value === undefined ? null : Math.round(Number(value) * 10) / 10);
  return {
    mean: one(stats.rows[0]?.mean),
    median: one(stats.rows[0]?.median),
    buckets: Array.from({ length: 10 }, (_, index) => ({ from: index * 10, to: index * 10 + 10, count: Number(rows.find((row) => Number(row.bucket) === index)?.n ?? 0) })),
  };
}

export async function currentRubricVersion(tx: Tx): Promise<string | null> {
  const row = await tx.selectFrom('rubric_versions').select('version').where('is_current', '=', true).executeTakeFirst();
  return row?.version ?? null;
}

/** A relative change in percent, to one decimal; null when the previous window had nothing. */
export const percentChange = (current: number, previous: number): number | null => (previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null);

/** A change between two rates in percentage points, to one decimal; null when either is unmeasured. */
export const pointsChange = (current: number | null, previous: number | null): number | null => (current === null || previous === null ? null : Math.round((current - previous) * 1000) / 10);

/** §9: ≥ 99% of generation jobs reach a terminal state within 3 minutes. */
export const SLA = { seconds: 180, target: 0.99 } as const;
