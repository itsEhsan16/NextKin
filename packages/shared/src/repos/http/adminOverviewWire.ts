import { z } from 'zod';

import {
  ADMIN_GENERATION_KINDS,
  type AdminGenerationKind,
  type AdminKpi,
  type AdminKpiKey,
  type AdminOverview,
  type AdminProvider,
  type AdminRange,
} from '../../models/admin';

/**
 * What `GET /admin/overview?range=` answers (`packages/server/src/services/admin/overview.ts`, the
 * definitions in `overviewMetrics.ts`) and how it maps onto `AdminOverview`. Every figure comes from
 * the server; a value it doesn't record stays `null` here too.
 */

const delta = z.number().nullable();
const rate = z
  .object({
    key: z.enum(['activation', 'reliability', 'conversion']),
    value: z.number(),
    delta,
    target: z.number(),
    trend: z.array(z.number()),
    basis: z.object({ cohort: z.number(), hit: z.number() }),
  })
  .nullable();

export const overviewWireSchema = z.object({
  range: z.enum(['7d', '30d', '90d']),
  signups: z.object({ value: z.number(), delta, trend: z.array(z.number()) }),
  activation: rate,
  reliability: rate,
  conversion: rate,
  generations: z.object({
    kinds: z.array(z.object({ kind: z.string(), runs: z.number(), failed: z.number() })),
    delta,
    p95Seconds: z.number().nullable(),
    days: z.array(
      z.object({ date: z.string(), runs: z.record(z.string(), z.number()), failed: z.number() }),
    ),
  }),
  pipeline: z.object({
    status: z.enum(['healthy', 'degraded']),
    queueDepth: z.number(),
    queueState: z.enum(['normal', 'backlogged']),
    p95Seconds: z.number().nullable(),
    p95TargetSeconds: z.number(),
    slaMetRate: z.number().nullable(),
    slaTargetRate: z.number(),
  }),
  aiCost: z.object({
    totalUsd: z.number(),
    delta,
    stages: z.array(z.object({ key: z.string(), usd: z.number() })),
    costPerResumeUsd: z.number().nullable(),
  }),
  subscriptions: z.object({
    activePro: z.number(),
    delta,
    newThisMonth: z.number().nullable(),
    revenue: z.array(
      z.object({
        currency: z.enum(['USD', 'EUR', 'AUD']),
        amountMinor: z.number(),
        usdMinor: z.number().nullable(),
        subscribers: z.number(),
      }),
    ),
    monthlyShare: z.number().nullable(),
  }),
  ats: z.object({
    mean: z.number().nullable(),
    delta,
    rubricVersion: z.string().nullable(),
    buckets: z.array(z.object({ from: z.number(), to: z.number(), count: z.number() })),
  }),
  providers: z.array(
    z.object({
      provider: z.string(),
      enabled: z.boolean(),
      calls: z.number(),
      share: z.number(),
      errorRate: z.number().nullable(),
    }),
  ),
});

export type OverviewWire = z.infer<typeof overviewWireSchema>;

/** The pipeline stages `ai_calls` records, as staff read them; evaluation and developer spend too. */
const STAGE_LABEL: Record<string, string> = {
  eval: 'Prompt evaluations',
  dev: 'Developer calls',
  jd_extract: 'Structure JD',
  resume_generate: 'Write resume',
  resume_revise: 'Revise resume',
  zero_generate: 'Zero Resume',
  cover_write: 'Cover letter',
  interview_write: 'Interview prep',
  figure_draft: 'Draft figures',
  keyword_questions: 'Keyword questions',
  kb_candidates: 'KB candidates',
};

/** "tailor_rewrite" reads "Tailor rewrite" when no label is listed. */
const stageLabel = (key: string) => {
  const listed = STAGE_LABEL[key];
  if (listed) return listed;
  const words = key.replace(/[_.]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const PROVIDER_LABEL: Record<string, string> = {
  adzuna: 'Adzuna',
  jsearch: 'JSearch',
  fixture: 'Fixture catalogue',
};
export const providerLabel = (name: string) =>
  PROVIDER_LABEL[name] ?? name.charAt(0).toUpperCase() + name.slice(1);

const asKind = (kind: string): AdminGenerationKind | null =>
  (ADMIN_GENERATION_KINDS as readonly string[]).includes(kind)
    ? (kind as AdminGenerationKind)
    : null;

function kpi(
  key: Exclude<AdminKpiKey, 'signups'>,
  wire: NonNullable<OverviewWire['activation']>,
): AdminKpi {
  return {
    key,
    value: wire.value,
    format: 'rate',
    delta: wire.delta === null ? null : { value: wire.delta, unit: 'points' },
    basis: { kind: 'target', rate: wire.target },
    trend: wire.trend,
    measured: wire.basis,
  };
}

export function toOverview(raw: unknown, range: AdminRange): AdminOverview {
  const w = overviewWireSchema.parse(raw);
  const kpis: AdminKpi[] = [
    {
      key: 'signups',
      value: w.signups.value,
      format: 'count',
      delta: w.signups.delta === null ? null : { value: w.signups.delta, unit: 'percent' },
      basis: { kind: 'previous' },
      trend: w.signups.trend,
    },
  ];
  // A rate with an empty cohort has nothing to measure: its card says so rather than show 0%.
  const unmeasured: AdminKpiKey[] = [];
  for (const key of ['activation', 'reliability', 'conversion'] as const) {
    const value = w[key];
    if (value) kpis.push(kpi(key, value));
    else unmeasured.push(key);
  }

  const totals = Object.fromEntries(
    ADMIN_GENERATION_KINDS.map((kind) => [kind, { runs: 0, failed: 0 }]),
  ) as Record<AdminGenerationKind, { runs: number; failed: number }>;
  for (const row of w.generations.kinds) {
    const kind = asKind(row.kind);
    if (!kind) continue;
    totals[kind].runs += row.runs;
    totals[kind].failed += row.failed;
  }

  return {
    range,
    kpis,
    ...(unmeasured.length ? { unmeasured } : {}),
    generations: {
      totals,
      delta: w.generations.delta === null ? null : { value: w.generations.delta, unit: 'percent' },
      p95Seconds: w.generations.p95Seconds,
      days: w.generations.days.map((day) => ({
        date: day.date,
        runs: Object.fromEntries(
          ADMIN_GENERATION_KINDS.map((kind) => [kind, day.runs[kind] ?? 0]),
        ) as Record<AdminGenerationKind, number>,
        failed: day.failed,
      })),
    },
    pipeline: w.pipeline,
    aiCost: {
      totalUsd: w.aiCost.totalUsd,
      delta: w.aiCost.delta === null ? null : { value: w.aiCost.delta, unit: 'percent' },
      stages: w.aiCost.stages.map((stage) => ({ ...stage, label: stageLabel(stage.key) })),
      costPerResumeUsd: w.aiCost.costPerResumeUsd,
    },
    subscriptions: {
      activePro: w.subscriptions.activePro,
      delta: w.subscriptions.delta === null ? null : { value: w.subscriptions.delta, unit: 'percent' },
      newThisMonth: w.subscriptions.newThisMonth,
      revenue: w.subscriptions.revenue,
      monthlyShare: w.subscriptions.monthlyShare,
    },
    ats: {
      mean: w.ats.mean,
      delta: w.ats.delta === null ? null : { value: w.ats.delta, unit: 'points' },
      rubricVersion: w.ats.rubricVersion,
      buckets: w.ats.buckets,
    },
    providers: w.providers.map(
      (row): AdminProvider => ({
        provider: row.provider,
        label: providerLabel(row.provider),
        enabled: row.enabled,
        share: row.share,
        errorRate: row.errorRate,
      }),
    ),
  };
}
