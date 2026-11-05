import { z } from 'zod';

import type {
  AdminJobProvider,
  AdminPlan,
  CohortCell,
  PlanQuota,
  RetentionCohort,
} from '../../models/adminBusiness';
import { providerLabel } from './adminOverviewWire';
import type { planStatsSchema, providerStatsSchema } from './adminBusinessReport';

/**
 * What the Business routes answer (`packages/server/src/services/admin/catalog.ts`,
 * `retention.ts`) and how each answer maps onto the shared models, for `adminBusinessRepo.ts`.
 * Anything the server doesn't measure stays `null`: no figure is filled in here.
 */

/** `catalog.listPlans`: Free has no period and no prices, and `quotas` holds feature flags too. */
export const plansSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        tier: z.string(),
        name: z.string(),
        period: z.string().nullable(),
        prices: z
          .object({ USD: z.number(), EUR: z.number(), AUD: z.number() })
          .partial()
          .nullable(),
        quotas: z.record(z.string(), z.unknown()).nullable(),
      })
      .passthrough(),
  ),
});

/** `retention.weekFourRetention`, newest week first. */
export const retentionSchema = z.object({
  data: z.array(
    z.object({
      week: z.string(),
      activated: z.number(),
      returned: z.number(),
      rate: z.number().nullable(),
      complete: z.boolean(),
    }),
  ),
});

/** `catalog.listProviders`: whether a key is set, never the key. */
export const providersSchema = z.object({
  data: z.array(
    z
      .object({
        provider: z.string(),
        enabled: z.boolean(),
        countries: z.array(z.string()).nullable().optional(),
        limits: z.object({ dailyCalls: z.number().nullable().optional() }).passthrough().nullable(),
        keySet: z.boolean(),
      })
      .passthrough(),
  ),
});

/**
 * The quotas the server meters or caps (`catalog.ts` QUOTA_KEYS, `services/plan.ts`), in the
 * board's order. A plan's `quotas` also holds `docx` and `priority_queue`, which are features, not
 * quotas: they aren't listed, and the quota route refuses them. Saved jobs and visible versions are
 * caps rather than monthly meters, so their labels say what they count per.
 */
const QUOTAS: Omit<PlanQuota, 'limit'>[] = [
  { key: 'generation', label: 'Generations per month', per: 'month' },
  { key: 'cover_letter', label: 'Cover letters per month', per: 'month' },
  { key: 'ats_check', label: 'ATS checks per month', per: 'month' },
  { key: 'interview_set', label: 'Interview question sets', per: 'month' },
  { key: 'interview_set_per_resume', label: 'Interview question sets', per: 'resume' },
  { key: 'zero_resume', label: 'Zero Resume', per: 'month' },
  { key: 'assistant_message_daily', label: 'Assistant messages per day', per: 'month' },
  { key: 'saved_jobs', label: 'Saved jobs per account', per: 'month' },
  { key: 'versions_visible', label: 'Visible versions', per: 'resume' },
];

/** The keys the quota route accepts. */
export const QUOTA_KEYS = new Set(QUOTAS.map((quota) => quota.key));

const isLimit = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value));

/** A plan, with its member count and last quota change where `/admin/plans/stats` answered. */
export function toPlan(
  row: z.infer<typeof plansSchema>['data'][number],
  stats: z.infer<typeof planStatsSchema> | null = null,
): AdminPlan {
  const served = row.quotas ?? {};
  return {
    id: row.id,
    tier: row.tier === 'free' ? 'free' : 'pro',
    name: row.name,
    // The Free plan has no period; its meters still reset monthly.
    period: row.period === 'year' ? 'year' : 'month',
    prices: { USD: row.prices?.USD ?? 0, EUR: row.prices?.EUR ?? 0, AUD: row.prices?.AUD ?? 0 },
    // Accounts on the plan now (the row's own `active` says whether it is offered). How many were
    // on it a month ago isn't recorded, so there is no change.
    active: stats?.active[row.id] ?? null,
    activeDelta: null,
    quotas: QUOTAS.flatMap((quota) => {
      const limit = served[quota.key];
      return isLimit(limit) ? [{ ...quota, limit }] : [];
    }),
    quotasChanged: stats?.quotasChanged[row.id] ?? null,
  };
}

/** Free, then Pro monthly, then Pro annual, as the board lays them out; the API sorts by id. */
export const planRank = (plan: AdminPlan) =>
  plan.tier === 'free' ? 0 : plan.period === 'month' ? 1 : 2;

/**
 * A provider, with today's traffic and errors where `/admin/providers/stats` answered (counted per
 * call since migration 0054). Health is read from today's error rate; with no calls, there is none.
 */
/** At or above this error rate today a provider reads as degraded (the Overview's amber). */
const PROVIDER_DEGRADED = 0.01;

const NO_CALLS = {
  callsToday: 0,
  errorRate: null,
  errorTrend: [],
  keyAddedAt: null,
  keyAddedBy: null,
  pausedBy: null,
};

export function toProvider(
  row: z.infer<typeof providersSchema>['data'][number],
  stats: z.infer<typeof providerStatsSchema> | null = null,
): AdminJobProvider {
  const name = row.provider;
  // Served stats without this provider: nothing counted for it this week, so no calls today.
  const today = stats ? (stats[name] ?? NO_CALLS) : null;
  const errorRate = today?.errorRate ?? null;
  return {
    provider: name,
    label: providerLabel(name),
    subtitle: row.countries?.length ? row.countries.join(', ') : 'All countries',
    enabled: row.enabled,
    health: !row.enabled
      ? 'paused'
      : errorRate === null
        ? null
        : errorRate >= PROVIDER_DEGRADED
          ? 'degraded'
          : 'healthy',
    key: {
      set: row.keySet,
      addedAt: today?.keyAddedAt ?? null,
      addedBy: today?.keyAddedBy ?? null,
    },
    quota: { used: today ? today.callsToday : null, ceiling: row.limits?.dailyCalls ?? null },
    errorRate,
    errorTrend: today?.errorTrend ?? [],
    // Why calls fail isn't recorded, only that they did.
    errorNote: null,
    attribution: null,
    pausedBy: row.enabled ? null : (today?.pausedBy ?? null),
  };
}

/** The served week-4 rate per signup week, oldest week first; the weeks between aren't measured. */
export function toCohorts(rows: z.infer<typeof retentionSchema>['data']): RetentionCohort[] {
  return [...rows]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((row) => {
      const weeks: CohortCell[] = Array.from({ length: 7 }, (_, week): CohortCell => {
        if (week === 0) return { rate: 1 };
        if (week !== 4) return { state: 'unmeasured' };
        return row.complete && row.rate !== null ? { rate: row.rate } : { state: 'future' };
      });
      const label = new Date(`${row.week}T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
      return { label, users: row.activated, weeks };
    });
}
