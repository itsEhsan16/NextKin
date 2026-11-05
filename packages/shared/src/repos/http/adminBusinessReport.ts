import { z } from 'zod';

import type {
  AdminAnalyticsPage,
  AnalyticsRange,
  BusinessStaffRef,
  CompPage,
  PriceVersion,
  QuotaUse,
} from '../../models/adminBusiness';
import { toCohorts, type retentionSchema } from './adminBusinessWire';

/**
 * The Business routes the portal added (`packages/server/src/http/routes/adminBusiness.ts`;
 * `services/admin/business.ts`, `businessAnalytics.ts`) and how each maps onto the shared models.
 * A figure the server doesn't record comes back `null` and stays `null` here.
 */

const role = z.enum(['support', 'curator', 'admin', 'super_admin']);
const staff = z.object({ name: z.string(), role: z.string().nullable() }).nullable();
const priceSet = z.object({ USD: z.number(), EUR: z.number(), AUD: z.number() });

/** A staff reference as a record names them; a role the list doesn't know reads as admin. */
const toStaff = (value: z.infer<typeof staff>): BusinessStaffRef | null =>
  value ? { name: value.name, role: role.safeParse(value.role).data ?? 'admin' } : null;

export const priceBookSchema = z.object({
  data: z.array(
    z.object({
      version: z.number(),
      effectiveFrom: z.string(),
      monthly: priceSet,
      annual: priceSet,
      createdBy: staff,
      status: z.enum(['active', 'retired']),
    }),
  ),
});

export const toPriceBook = (raw: unknown): PriceVersion[] =>
  priceBookSchema
    .parse(raw)
    .data.map((row) => ({ ...row, createdBy: toStaff(row.createdBy) }));

export const compsSchema = z.object({
  rows: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      months: z.number().nullable(),
      reason: z.string().nullable(),
      grantedBy: staff,
      startedAt: z.string(),
      endsAt: z.string().nullable(),
    }),
  ),
  page: z.number(),
  pages: z.number(),
  active: z.number(),
});

/** A comp with no end date never ends on its own; the list shows the masked user only. */
export const toComps = (raw: unknown): CompPage => {
  const page = compsSchema.parse(raw);
  return {
    ...page,
    rows: page.rows.map((row) => ({
      id: row.id,
      userRef: row.userId,
      months: row.months ?? 0,
      reason: row.reason ?? '',
      grantedBy: toStaff(row.grantedBy),
      startedAt: row.startedAt,
      endsAt: row.endsAt ?? '',
    })),
  };
};

export const planStatsSchema = z.object({
  active: z.record(z.string(), z.number()),
  quotasChanged: z.record(z.string(), z.object({ at: z.string(), by: z.string() })),
});

export const providerStatsSchema = z.record(
  z.string(),
  z.object({
    callsToday: z.number(),
    errorRate: z.number().nullable(),
    errorTrend: z.array(z.number()),
    keyAddedAt: z.string().nullable(),
    keyAddedBy: z.string().nullable(),
    pausedBy: z.object({ name: z.string(), at: z.string() }).nullable(),
  }),
);

const bucket = z.object({ from: z.number(), to: z.number(), count: z.number() });

export const reportSchema = z.object({
  range: z.enum(['7d', '30d', '90d']),
  funnel: z.object({
    conversion: z.number(),
    deltaPoints: z.number().nullable(),
    steps: z.array(z.object({ key: z.string(), label: z.string(), count: z.number() })),
  }),
  generations: z.object({
    rows: z.array(z.object({ kind: z.string(), count: z.number() })),
    total: z.number(),
    perActiveUser: z.number().nullable(),
    failed: z.number(),
    failedRate: z.number().nullable(),
    p95Seconds: z.number().nullable(),
  }),
  ats: z.object({
    mean: z.number().nullable(),
    deltaPoints: z.number().nullable(),
    median: z.number().nullable(),
    rubricVersion: z.string().nullable(),
    buckets: z.array(bucket),
  }),
  quota: z.object({
    planLabel: z.string(),
    atCapShare: z.number(),
    deltaPoints: z.number().nullable(),
    rows: z.array(z.object({ key: z.string(), cap: z.number(), atCapShare: z.number() })),
  }),
  providerUsage: z.object({
    rows: z.array(
      z.object({
        tag: z.string(),
        provider: z.string(),
        calls: z.number(),
        tokens: z.number().nullable(),
        costUsd: z.number(),
        cacheHitRate: z.number().nullable(),
        errorRate: z.number().nullable(),
      }),
    ),
    totalUsd: z.number(),
  }),
});

const KIND_LABEL: Record<string, string> = {
  resume: 'Resume',
  tailor: 'Tailor',
  cover_letter: 'Cover letter',
  ats_check: 'ATS check',
  interview: 'Interview',
};

const QUOTA_LABEL: Record<string, string> = {
  generation: 'Generations',
  ats_check: 'ATS checks',
  cover_letter: 'Cover letters',
  zero_resume: 'Zero Resume',
  interview_set: 'Interview sets',
};

const MODEL_PROVIDER: Record<string, string> = {
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  bedrock: 'Bedrock',
};

export function toAnalyticsReport(
  raw: unknown,
  retention: z.infer<typeof retentionSchema>['data'] | null,
): AdminAnalyticsPage {
  const report = reportSchema.parse(raw);
  const complete = (retention ?? []).filter((row) => row.complete && row.rate !== null);
  return {
    range: report.range as AnalyticsRange,
    funnel: report.funnel,
    retention: retention && {
      cohorts: toCohorts(retention),
      week4Average: complete.length
        ? complete.reduce((sum, row) => sum + (row.rate ?? 0), 0) / complete.length
        : null,
    },
    generations: {
      ...report.generations,
      rows: report.generations.rows.map((row) => ({
        kind: row.kind,
        label: KIND_LABEL[row.kind] ?? row.kind,
        count: row.count,
      })),
    },
    ats: report.ats,
    quota: {
      planLabel: report.quota.planLabel,
      atCapShare: report.quota.atCapShare,
      deltaPoints: report.quota.deltaPoints,
      rows: report.quota.rows.map(
        (row): QuotaUse => ({
          key: row.key,
          label: QUOTA_LABEL[row.key] ?? row.key,
          cap: `cap ${row.cap} a month`,
          atCapShare: row.atCapShare,
        }),
      ),
    },
    providerUsage: {
      totalUsd: report.providerUsage.totalUsd,
      rows: report.providerUsage.rows.map((row) => ({
        ...row,
        provider: MODEL_PROVIDER[row.provider] ?? row.provider,
      })),
    },
  };
}
