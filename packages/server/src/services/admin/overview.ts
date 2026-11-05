import { sql } from 'kysely';

import type { Database, Tx } from '../../db/database';
import { activation, atsScores, conversion, currentRubricVersion, percentChange, pointsChange, reliability, runsByKind, runTimes, signups, SLA, windowsFor, type MetricRange, type Window } from './overviewMetrics';

/**
 * The admin Overview for one window (V2 §7.17 "analytics dashboards"; Figma 394:536), every figure
 * computed from our own tables. The definitions are in `overviewMetrics.ts`; this file adds the
 * pipeline, money, AI spend and job providers. Where nothing records a figure it is `null`, with
 * the reason beside it: subscription history isn't kept, so the Pro count has no change.
 */

/** V2 §2.2 targets. */
export const TARGETS = { activation: 0.55, reliability: 0.98, conversion: 0.03 } as const;
const SLA_SECONDS = SLA.seconds;
const SLA_TARGET = SLA.target;
/** A run waiting longer than this to start means the queue is behind (§9: scaling reacts in ~2 min). */
const BACKLOG_SECONDS = 120;
/** The days the Overview's chart draws, whatever the window. */
const CHART_DAYS = 14;

export async function overview(db: Database, range: MetricRange, now = new Date()) {
  return db.withSystem('admin: overview aggregates', async (tx) => {
    const { current: w, previous: p } = windowsFor(range, now);
    const [sNow, sPrev] = [await signups(tx, w), await signups(tx, p)];
    const [aNow, aPrev] = [await activation(tx, w, now), await activation(tx, p, now)];
    const [rNow, rPrev] = [await reliability(tx, w), await reliability(tx, p)];
    const [cNow, cPrev] = [await conversion(tx, w), await conversion(tx, p)];
    const kinds = await runsByKind(tx, w);
    const runsPrev = (await runsByKind(tx, p)).reduce((sum, row) => sum + row.runs, 0);
    const runs = kinds.reduce((sum, row) => sum + row.runs, 0);
    const times = await runTimes(tx, w, SLA_SECONDS);
    const [atsNow, atsPrev] = [await atsScores(tx, w), await atsScores(tx, p)];

    const rate = (key: keyof typeof TARGETS, cur: { rate: number | null; trend: number[]; cohort: number; hit: number }, prev: { rate: number | null }) =>
      cur.rate === null ? null : { key, value: cur.rate, delta: pointsChange(cur.rate, prev.rate), target: TARGETS[key], trend: cur.trend, basis: { cohort: cur.cohort, hit: cur.hit } };

    return {
      range,
      window: { from: w.from.toISOString(), to: w.to.toISOString() },
      signups: { value: sNow.total, delta: percentChange(sNow.total, sPrev.total), trend: sNow.trend },
      // A rate is null when its cohort is empty: nothing to measure (the card says so). `basis` is
      // the count behind it (G16: every number shows its basis).
      activation: rate('activation', aNow, aPrev),
      reliability: rate('reliability', rNow, rPrev),
      conversion: rate('conversion', cNow, cPrev),
      generations: { kinds, delta: percentChange(runs, runsPrev), p95Seconds: times.p95Ready, days: await chartDays(tx, now) },
      pipeline: await pipeline(tx, times),
      aiCost: await aiCost(tx, w, p),
      subscriptions: await subscriptions(tx, now),
      ats: {
        mean: atsNow.mean,
        // The scores are already 0–100, so the change is in points as it stands.
        delta: atsNow.mean !== null && atsPrev.mean !== null ? Math.round((atsNow.mean - atsPrev.mean) * 10) / 10 : null,
        rubricVersion: await currentRubricVersion(tx),
        buckets: atsNow.buckets,
      },
      providers: await providersToday(tx),
    };
  });
}

/** The last fourteen UTC days' runs by kind, oldest first, and how many of each day's runs failed. */
async function chartDays(tx: Tx, now: Date) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const from = new Date(today - (CHART_DAYS - 1) * 86_400_000);
  const { rows } = await sql<{ day: string; kind: string; runs: number; failed: number }>`
    SELECT (created_at AT TIME ZONE 'utc')::date::text AS day,
           CASE WHEN kind = 'resume' AND input ? 'tailor' THEN 'tailor' WHEN kind IN ('resume', 'zero_resume', 'section') THEN 'resume' ELSE kind END AS kind,
           count(*)::int AS runs, count(*) FILTER (WHERE status = 'failed')::int AS failed
    FROM app.generations WHERE created_at >= ${from}
    GROUP BY 1, 2`.execute(tx);
  return Array.from({ length: CHART_DAYS }, (_, i) => {
    const date = new Date(from.getTime() + i * 86_400_000).toISOString();
    const day = date.slice(0, 10);
    const ofDay = rows.filter((row) => row.day === day);
    return {
      date,
      runs: Object.fromEntries(ofDay.map((row) => [row.kind, Number(row.runs)])) as Record<string, number>,
      failed: ofDay.reduce((sum, row) => sum + Number(row.failed), 0),
    };
  });
}

/** Queue depth is the runs waiting to start now; the times are over the window's finished runs. */
async function pipeline(tx: Tx, times: Awaited<ReturnType<typeof runTimes>>) {
  const queued = await sql<{ depth: number; oldest: number | null }>`
    SELECT count(*)::int AS depth, extract(epoch FROM now() - min(coalesce(started_at, created_at)))::int AS oldest
    FROM app.generations WHERE status = 'queued'`.execute(tx);
  const depth = Number(queued.rows[0]?.depth ?? 0);
  const oldest = queued.rows[0]?.oldest ?? null;
  const backlogged = oldest !== null && Number(oldest) > BACKLOG_SECONDS;
  const slaMetRate = times.terminal ? times.withinSla / times.terminal : null;
  return {
    status: backlogged || (slaMetRate !== null && slaMetRate < SLA_TARGET) ? 'degraded' : 'healthy',
    queueDepth: depth,
    oldestQueuedSeconds: oldest === null ? null : Number(oldest),
    queueState: backlogged ? 'backlogged' : 'normal',
    p95Seconds: times.p95Terminal,
    p95TargetSeconds: SLA_SECONDS,
    slaMetRate,
    slaTargetRate: SLA_TARGET,
  };
}

/**
 * Spend from `ai_calls` (micros of USD). Product calls are split by the pipeline stage they ran in;
 * evaluation and developer calls are a row each, so the stages add up to the total. Cost per resume
 * is the product spend of the window's finished resume runs (built, tailored or Zero Resume) over
 * how many there were.
 */
async function aiCost(tx: Tx, w: Window, p: Window) {
  const { rows } = await sql<{ key: string; micros: string }>`
    SELECT CASE WHEN tag = 'product' THEN stage ELSE tag END AS key, sum(cost_micros)::text AS micros
    FROM app.ai_calls WHERE created_at >= ${w.from} AND created_at < ${w.to}
    GROUP BY 1`.execute(tx);
  const prev = await sql<{ micros: string | null }>`
    SELECT sum(cost_micros)::text AS micros FROM app.ai_calls WHERE created_at >= ${p.from} AND created_at < ${p.to}`.execute(tx);
  const perResume = await sql<{ runs: number; micros: string | null }>`
    SELECT count(DISTINCT g.id)::int AS runs, (SELECT sum(a.cost_micros) FROM app.ai_calls a WHERE a.tag = 'product' AND a.generation_id IN (
             SELECT id FROM app.generations WHERE status = 'ready' AND kind IN ('resume', 'zero_resume') AND created_at >= ${w.from} AND created_at < ${w.to}))::text AS micros
    FROM app.generations g WHERE g.status = 'ready' AND g.kind IN ('resume', 'zero_resume') AND g.created_at >= ${w.from} AND g.created_at < ${w.to}`.execute(tx);
  const usd = (micros: string | null | undefined) => Number(micros ?? 0) / 1e6;
  const stages = rows.map((row) => ({ key: row.key, usd: usd(row.micros) })).sort((a, b) => b.usd - a.usd);
  const totalUsd = stages.reduce((sum, stage) => sum + stage.usd, 0);
  const resumeRuns = Number(perResume.rows[0]?.runs ?? 0);
  return {
    totalUsd,
    delta: percentChange(totalUsd, usd(prev.rows[0]?.micros)),
    stages,
    costPerResumeUsd: resumeRuns ? usd(perResume.rows[0]?.micros) / resumeRuns : null,
  };
}

/**
 * Paying Pro: subscriptions the gateway bills (a staff comp has no gateway id) that are active now.
 * Revenue is monthly recurring revenue per currency, net of tax: each such subscription's latest
 * successful payment, an annual one divided by 12. No exchange rate is held, so only USD has a USD
 * value. Subscription history isn't recorded, so the count has no change against the last window.
 */
async function subscriptions(tx: Tx, now: Date) {
  const counts = await sql<{ active: number; monthly: number; new_this_month: number }>`
    SELECT count(*) FILTER (WHERE status = 'active')::int AS active,
           count(*) FILTER (WHERE status = 'active' AND plan_id = 'pro_monthly')::int AS monthly,
           count(*) FILTER (WHERE created_at >= date_trunc('month', ${now}::timestamptz AT TIME ZONE 'utc') AT TIME ZONE 'utc')::int AS new_this_month
    FROM app.subscriptions WHERE plan_id LIKE 'pro%' AND gateway_subscription_id IS NOT NULL`.execute(tx);
  const revenue = await sql<{ currency: string; minor: string; subscribers: number }>`
    SELECT p.currency, round(sum(CASE WHEN s.plan_id = 'pro_annual' THEN (p.amount_minor - p.tax_minor) / 12.0 ELSE p.amount_minor - p.tax_minor END))::text AS minor,
           count(*)::int AS subscribers
    FROM app.subscriptions s
    JOIN LATERAL (
      SELECT currency, amount_minor, tax_minor FROM app.payments
      WHERE subscription_id = s.id AND status = 'succeeded' ORDER BY occurred_at DESC LIMIT 1
    ) p ON true
    WHERE s.plan_id LIKE 'pro%' AND s.gateway_subscription_id IS NOT NULL AND s.status = 'active'
    GROUP BY p.currency ORDER BY 2 DESC`.execute(tx);
  const c = counts.rows[0];
  const active = Number(c?.active ?? 0);
  return {
    activePro: active,
    delta: null,
    newThisMonth: Number(c?.new_this_month ?? 0),
    revenue: revenue.rows.map((row) => ({ currency: row.currency, amountMinor: Number(row.minor), usdMinor: row.currency === 'USD' ? Number(row.minor) : null, subscribers: Number(row.subscribers) })),
    monthlyShare: active ? Number(c?.monthly ?? 0) / active : null,
  };
}

/** Today's job lookups (UTC) per provider, from `job_provider_calls` (migration 0054). */
export async function providersToday(tx: Tx) {
  const { rows } = await sql<{ provider: string; enabled: boolean; calls: number; errors: number }>`
    SELECT c.provider, c.enabled, coalesce(t.calls, 0)::int AS calls, coalesce(t.errors, 0)::int AS errors
    FROM app.job_provider_configs c
    LEFT JOIN app.job_provider_calls t ON t.provider = c.provider AND t.day = (now() AT TIME ZONE 'utc')::date
    ORDER BY c.priority`.execute(tx);
  const total = rows.reduce((sum, row) => sum + Number(row.calls), 0);
  return rows.map((row) => ({
    provider: row.provider,
    enabled: row.enabled,
    calls: Number(row.calls),
    share: total ? Number(row.calls) / total : 0,
    // No calls today: no rate to show, rather than a 0% nobody measured.
    errorRate: Number(row.calls) ? Number(row.errors) / Number(row.calls) : null,
  }));
}
