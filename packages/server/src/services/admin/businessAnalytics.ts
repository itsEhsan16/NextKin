import { sql } from 'kysely';

import type { Database, Tx } from '../../db/database';
import { FREE_QUOTAS, type PlanQuotas } from '../plan';
import { atsScores, currentRubricVersion, runsByKind, runTimes, SLA, windowsFor, type MetricRange, type Window } from './overviewMetrics';

/**
 * The Analytics page for one window (V2 §7.17: "signups, activation and generation funnels, ATS
 * score distributions, quota consumption, provider usage/cost"; Figma 407:1430). Aggregate only.
 * Retention is its own route (`retention.ts`).
 */

/** The meters a Free user can run into in a month, in the page's order (`services/plan.ts`). */
const MONTHLY_METERS = ['generation', 'ats_check', 'cover_letter', 'zero_resume', 'interview_set'] as const;

export async function analyticsReport(db: Database, range: MetricRange, now = new Date()) {
  return db.withSystem('admin: analytics report', async (tx) => {
    const { current: w, previous: p } = windowsFor(range, now);
    const [fNow, fPrev] = [await funnel(tx, w), await funnel(tx, p)];
    const kinds = await runsByKind(tx, w);
    const total = kinds.reduce((sum, row) => sum + row.runs, 0);
    const failed = kinds.reduce((sum, row) => sum + row.failed, 0);
    const runners = await sql<{ n: number }>`
      SELECT count(DISTINCT user_id)::int AS n FROM app.generations WHERE created_at >= ${w.from} AND created_at < ${w.to}`.execute(tx);
    const people = Number(runners.rows[0]?.n ?? 0);
    const times = await runTimes(tx, w, SLA.seconds);
    const [atsNow, atsPrev] = [await atsScores(tx, w), await atsScores(tx, p)];
    const rate = (f: { steps: { count: number }[] }) => (f.steps[0]!.count ? f.steps[f.steps.length - 1]!.count / f.steps[0]!.count : null);
    const conversion = rate(fNow);
    const before = rate(fPrev);
    return {
      range,
      funnel: {
        conversion: conversion ?? 0,
        deltaPoints: conversion !== null && before !== null ? Math.round((conversion - before) * 1000) / 10 : null,
        steps: fNow.steps,
      },
      generations: {
        rows: kinds.sort((a, b) => b.runs - a.runs).map((row) => ({ kind: row.kind, count: row.runs })),
        total,
        // Runs per person who ran anything in the window.
        perActiveUser: people ? total / people : null,
        failed,
        failedRate: total ? failed / total : null,
        p95Seconds: times.p95Ready,
      },
      ats: {
        mean: atsNow.mean,
        deltaPoints: atsNow.mean !== null && atsPrev.mean !== null ? Math.round((atsNow.mean - atsPrev.mean) * 10) / 10 : null,
        median: atsNow.median,
        rubricVersion: await currentRubricVersion(tx),
        buckets: atsNow.buckets,
      },
      quota: await freeQuota(tx),
      providerUsage: await modelUsage(tx, w),
    };
  });
}

/**
 * People who signed up in the window, and how far each got: a verified email, a first resume within
 * 72 hours (activation, V2 §2.2), a tailored run, and a paid Pro subscription. A later step counts
 * whenever it happened, so the steps of a recent window can still grow.
 */
async function funnel(tx: Tx, w: Window) {
  const { rows } = await sql<{ signed_up: number; verified: number; first_resume: number; tailored: number; pro: number }>`
    SELECT count(*)::int AS signed_up,
           count(*) FILTER (WHERE u.email_verified)::int AS verified,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM app.generations g WHERE g.user_id = u.id AND g.status = 'ready'
             AND g.kind IN ('resume', 'zero_resume') AND g.finished_at <= u.created_at + interval '72 hours'))::int AS first_resume,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM app.generations g WHERE g.user_id = u.id AND g.status = 'ready'
             AND g.kind = 'resume' AND g.input ? 'tailor'))::int AS tailored,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM app.subscriptions s WHERE s.user_id = u.id AND s.plan_id LIKE 'pro%'
             AND s.gateway_subscription_id IS NOT NULL))::int AS pro
    FROM app.users u WHERE u.role = 'user' AND u.created_at >= ${w.from} AND u.created_at < ${w.to}`.execute(tx);
  const r = rows[0];
  const n = (value: number | undefined) => Number(value ?? 0);
  return {
    steps: [
      { key: 'signed_up', label: 'Signed up', count: n(r?.signed_up) },
      { key: 'verified_email', label: 'Verified email', count: n(r?.verified) },
      { key: 'first_resume', label: 'First resume within 72 h', count: n(r?.first_resume) },
      { key: 'tailored', label: 'Tailored to a job', count: n(r?.tailored) },
      { key: 'started_pro', label: 'Started Pro', count: n(r?.pro) },
    ],
  };
}

/**
 * This calendar month (UTC), as the meters reset: of the people on Free now, the share who have used
 * every allowed run of each meter, and of any. Quotas are monthly, so the window doesn't change it.
 * Who was on Free last month isn't recorded, so there is no change against last month.
 */
async function freeQuota(tx: Tx) {
  const plan = await tx.selectFrom('plans').select('quotas').where('id', '=', 'free').executeTakeFirst();
  const quotas = { ...FREE_QUOTAS, ...((plan?.quotas ?? {}) as Partial<PlanQuotas>) };
  const meters = MONTHLY_METERS.filter((key) => typeof quotas[key] === 'number' && (quotas[key] as number) > 0);
  const free = sql`u.role = 'user' AND u.status = 'active' AND NOT EXISTS (
    SELECT 1 FROM app.subscriptions s WHERE s.user_id = u.id AND s.plan_id LIKE 'pro%' AND s.status IN ('active', 'trialing', 'past_due'))`;
  const people = await sql<{ n: number }>`SELECT count(*)::int AS n FROM app.users u WHERE ${free}`.execute(tx);
  const total = Number(people.rows[0]?.n ?? 0);
  if (!total) return { planLabel: 'Free plan', atCapShare: 0, deltaPoints: null, rows: [] };
  const { rows } = await sql<{ metric: string; used: number; user_id: string }>`
    SELECT c.metric, c.used, c.user_id FROM app.usage_counters c JOIN app.users u ON u.id = c.user_id
    WHERE ${free} AND c.period_start = date_trunc('month', now() AT TIME ZONE 'utc')::date`.execute(tx);
  const capped = new Set<string>();
  const out = meters.map((key) => {
    const cap = quotas[key] as number;
    const users = rows.filter((row) => row.metric === key && Number(row.used) >= cap).map((row) => row.user_id);
    users.forEach((id) => capped.add(id));
    return { key, cap, atCapShare: users.length / total };
  });
  return { planLabel: 'Free plan', atCapShare: capped.size / total, deltaPoints: null, rows: out };
}

/**
 * Model calls in the window by pipeline stage and provider (`ai_calls`): calls, tokens in and out,
 * spend, the share of prompt tokens read from the cache, and the share of calls that didn't come
 * back usable (a refusal, invalid output, an error or a spend cap).
 */
async function modelUsage(tx: Tx, w: Window) {
  const { rows } = await sql<{ stage: string; provider: string; calls: number; tokens: string; micros: string; cache_read: string; prompt: string; failed: number }>`
    SELECT CASE WHEN tag = 'product' THEN stage ELSE tag END AS stage, provider, count(*)::int AS calls,
           sum(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens)::text AS tokens,
           sum(cost_micros)::text AS micros,
           sum(cache_read_tokens)::text AS cache_read,
           sum(input_tokens + cache_read_tokens + cache_write_tokens)::text AS prompt,
           count(*) FILTER (WHERE outcome <> 'ok')::int AS failed
    FROM app.ai_calls WHERE created_at >= ${w.from} AND created_at < ${w.to}
    GROUP BY 1, 2`.execute(tx);
  const out = rows
    .map((row) => ({
      tag: row.stage,
      provider: row.provider,
      calls: Number(row.calls),
      tokens: Number(row.tokens),
      costUsd: Number(row.micros) / 1e6,
      cacheHitRate: Number(row.prompt) ? Number(row.cache_read) / Number(row.prompt) : null,
      errorRate: Number(row.calls) ? Number(row.failed) / Number(row.calls) : null,
    }))
    .sort((a, b) => b.costUsd - a.costUsd);
  return { rows: out, totalUsd: out.reduce((sum, row) => sum + row.costUsd, 0) };
}
