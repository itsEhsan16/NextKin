import type { Tx } from '../db/database';

/**
 * What a user's plan allows, read from our own tables (V2 §13.3, §13.4; P12-08): the user's
 * subscription in a status that grants its tier, else the Free plan row. Never from the payment
 * gateway live, so paying users keep their features while it is unreachable.
 */

/** The meters (`usage_counters.metric`) and the caps that are not meters. null is unlimited. */
export interface PlanQuotas {
  generation: number | null;
  ats_check: number | null;
  cover_letter: number | null;
  zero_resume: number | null;
  /** Free: one set per generated resume (§13.3). */
  interview_set_per_resume: number | null;
  /** Free: standalone sets (no resume) a month. */
  interview_set: number | null;
  assistant_message_daily: number | null;
  saved_jobs: number | null;
  versions_visible: number;
  docx: boolean;
  priority_queue: boolean;
}

export interface PlanAllowance {
  tier: 'free' | 'pro';
  planId: string;
  quotas: PlanQuotas;
  /** Free sees the last 3 versions of a resume, Pro the last 20; older ones are locked, never deleted. */
  versionsVisible: number;
  docx: boolean;
  /** Open saved listings allowed; null is unlimited (Pro). */
  savedJobs: number | null;
  /** Assistant messages a day (toreview §105.18: Free 20, Pro 100). */
  assistantDaily: number;
}

/** §13.3's Free plan, used when the plan rows are not seeded (unit tests). */
export const FREE_QUOTAS: PlanQuotas = {
  generation: 3,
  ats_check: 3,
  cover_letter: 1,
  zero_resume: 1,
  interview_set_per_resume: 1,
  interview_set: 1,
  assistant_message_daily: 20,
  saved_jobs: 10,
  versions_visible: 3,
  docx: false,
  priority_queue: false,
};

/** Statuses that grant the plan's tier. `past_due` keeps it through the gateway's retry window. */
export const GRANTING = ['active', 'trialing', 'past_due'] as const;

function allowance(tier: 'free' | 'pro', planId: string, raw: Partial<PlanQuotas> | null): PlanAllowance {
  const base: PlanQuotas = tier === 'free' ? FREE_QUOTAS : { ...FREE_QUOTAS, generation: 100, ats_check: 30, cover_letter: null, zero_resume: null, interview_set_per_resume: null, interview_set: null, assistant_message_daily: 100, saved_jobs: null, versions_visible: 20, docx: true, priority_queue: true };
  const quotas = { ...base, ...(raw ?? {}) } as PlanQuotas;
  return {
    tier,
    planId,
    quotas,
    versionsVisible: quotas.versions_visible,
    docx: quotas.docx,
    savedJobs: quotas.saved_jobs,
    assistantDaily: quotas.assistant_message_daily ?? 100,
  };
}

export async function planOf(tx: Tx, userId: string): Promise<PlanAllowance> {
  const row = await tx
    .selectFrom('subscriptions as s')
    .innerJoin('plans as p', 'p.id', 's.plan_id')
    .select(['p.id', 'p.tier', 'p.quotas'])
    .where('s.user_id', '=', userId)
    .where('s.status', 'in', [...GRANTING])
    .orderBy('s.created_at', 'desc')
    .executeTakeFirst();
  if (row && row.tier === 'pro') return allowance('pro', row.id, row.quotas as Partial<PlanQuotas>);
  const free = await tx.selectFrom('plans').select('quotas').where('id', '=', 'free').executeTakeFirst();
  return allowance('free', 'free', (free?.quotas ?? null) as Partial<PlanQuotas> | null);
}
