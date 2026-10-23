import { sql } from 'kysely';

import type { Tx } from '../db/database';
import { AppError } from '../http/errors';
import { planOf, type PlanAllowance } from './plan';

/**
 * Quotas (ImBackendImplementationPlan P12-09; V2 §13.3, G2). Every metered run reserves its slot
 * when it starts and is charged when it completes:
 *
 * - **reserve** is one conditional update per meter, `used + reserved < limit`, in the start
 *   transaction. Past the cap it answers PLAN_LOCKED with the reason, the limit and the reset date,
 *   before any work begins (§13.5).
 * - **commit** turns the reservation into a charge in the run's terminal success transaction.
 * - **release** gives it back when the run fails, is cancelled or times out: a failed run costs
 *   nothing.
 *
 * The run records what it reserved (`generations.quota_reservation`), and `quota_charged_at` /
 * `quota_released_at` make commit and release happen at most once each, whatever is redelivered.
 */

export type Metric = 'generation' | 'ats_check' | 'cover_letter' | 'zero_resume' | 'interview_set' | 'assistant_message';
export type RunKindForQuota = 'resume' | 'zero_resume' | 'cover_letter' | 'ats_check' | 'interview' | 'section';

export interface Reserved {
  metric: Metric;
  periodStart: string;
}

const MONTH_START = sql<Date>`date_trunc('month', now() at time zone 'utc')::date`;
const MONTH_END = sql<Date>`(date_trunc('month', now() at time zone 'utc') + interval '1 month')::date`;

/** The words a refusal uses for each meter. */
const NOUN: Record<Metric, [string, string]> = {
  generation: ['generation', 'generations'],
  ats_check: ['ATS check', 'ATS checks'],
  cover_letter: ['cover letter', 'cover letters'],
  zero_resume: ['Zero Resume draft', 'Zero Resume drafts'],
  interview_set: ['interview practice set', 'interview practice sets'],
  assistant_message: ['assistant message', 'assistant messages'],
};

const nextMonthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
};

export function quotaRefusal(plan: PlanAllowance, metric: Metric | 'interview_set_per_resume', limit: number, resetsAt: Date | null): AppError {
  const when = resetsAt ? ` They reset on ${resetsAt.toISOString().slice(0, 10)}.` : '';
  const upgrade = plan.tier === 'free' ? ' Upgrade to NextKin Pro for more.' : '';
  const message =
    metric === 'interview_set_per_resume'
      ? `Free includes ${limit} interview practice set per resume, and this resume has one.${upgrade}`
      : `You have used this month’s ${limit} ${NOUN[metric][limit === 1 ? 0 : 1]}.${when}${upgrade}`;
  return new AppError('PLAN_LOCKED', message, { reason: metric, limit, ...(resetsAt ? { resetsAt: resetsAt.toISOString() } : {}) });
}

/** The meters a run spends, with each one's cap on this plan (null: counted, not capped). */
function metersFor(kind: RunKindForQuota, input: { sourceResumeId?: string | null }, plan: PlanAllowance): { metric: Metric; limit: number | null }[] {
  const q = plan.quotas;
  switch (kind) {
    case 'resume':
      return [{ metric: 'generation', limit: q.generation }];
    case 'zero_resume':
      // §13.3: a Zero Resume draft counts toward the generation quota too.
      return [
        { metric: 'generation', limit: q.generation },
        { metric: 'zero_resume', limit: q.zero_resume },
      ];
    case 'cover_letter':
      return [{ metric: 'cover_letter', limit: q.cover_letter }];
    case 'ats_check':
      return [{ metric: 'ats_check', limit: q.ats_check }];
    case 'interview':
      // A set about a resume is capped per resume (below); a standalone set by the month.
      return [{ metric: 'interview_set', limit: input.sourceResumeId ? null : q.interview_set }];
    case 'section':
      return [];
  }
}

/** Reserves the run's slots, or refuses it with PLAN_LOCKED. Call inside the start transaction. */
export async function reserveRun(tx: Tx, userId: string, kind: RunKindForQuota, input: { sourceResumeId?: string | null }, exceptGenerationId?: string): Promise<Reserved[]> {
  const plan = await planOf(tx, userId);
  const perResume = plan.quotas.interview_set_per_resume;
  if (kind === 'interview' && input.sourceResumeId && perResume !== null) {
    // Sets that exist for this resume, plus runs for it still in flight; serialized per resume, so
    // two starts at once cannot both pass.
    await sql`select pg_advisory_xact_lock(hashtext(${`interview-quota:${input.sourceResumeId}`}))`.execute(tx);
    const sets = await tx.selectFrom('interview_question_sets').select((eb) => eb.fn.countAll<string>().as('n')).where('resume_id', '=', input.sourceResumeId).executeTakeFirstOrThrow();
    let inflight = tx
      .selectFrom('generations')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .where('kind', '=', 'interview')
      .where('source_resume_id', '=', input.sourceResumeId)
      .where('status', 'not in', ['ready', 'failed']);
    if (exceptGenerationId) inflight = inflight.where('id', '<>', exceptGenerationId);
    const running = await inflight.executeTakeFirstOrThrow();
    if (Number(sets.n) + Number(running.n) >= perResume) throw quotaRefusal(plan, 'interview_set_per_resume', perResume, null);
  }
  const reserved: Reserved[] = [];
  for (const { metric, limit } of metersFor(kind, input, plan)) {
    await tx
      .insertInto('usage_counters')
      .values({ user_id: userId, metric, period_start: MONTH_START, period_end: MONTH_END, used: 0 })
      .onConflict((oc) => oc.columns(['user_id', 'metric', 'period_start']).doNothing())
      .execute();
    let update = tx
      .updateTable('usage_counters')
      .set({ reserved: sql`reserved + 1`, updated_at: sql`now()` })
      .where('user_id', '=', userId)
      .where('metric', '=', metric)
      .where('period_start', '=', MONTH_START);
    if (limit !== null) update = update.where(sql<boolean>`used + reserved < ${limit}`);
    const row = await update.returning(sql<string>`period_start::text`.as('period_start')).executeTakeFirst();
    if (!row) throw quotaRefusal(plan, metric, limit ?? 0, nextMonthStart());
    reserved.push({ metric, periodStart: row.period_start });
  }
  return reserved;
}

type RunRow = { id: string; user_id: string; quota_reservation: unknown; quota_charged_at: unknown; quota_released_at: unknown };

const reservationOf = (row: RunRow): Reserved[] | null => (Array.isArray(row.quota_reservation) ? (row.quota_reservation as Reserved[]) : null);

/**
 * Turns the reservation into a charge, once. Returns whether it did; the caller stamps
 * `quota_charged_at` in the same update that marks the run ready (a check ties the two).
 */
export async function commitRun(tx: Tx, row: RunRow): Promise<boolean> {
  const reserved = reservationOf(row);
  if (!reserved || row.quota_charged_at !== null || row.quota_released_at !== null) return false;
  for (const r of reserved) {
    await tx
      .updateTable('usage_counters')
      .set({ used: sql`used + 1`, reserved: sql`greatest(reserved - 1, 0)`, updated_at: sql`now()` })
      .where('user_id', '=', row.user_id)
      .where('metric', '=', r.metric)
      .where('period_start', '=', sql<Date>`${r.periodStart}::date`)
      .execute();
  }
  return true;
}

/** Gives the reservation back, once: a failed, cancelled or timed-out run costs nothing. */
export async function releaseRun(tx: Tx, row: RunRow): Promise<boolean> {
  const reserved = reservationOf(row);
  if (!reserved || row.quota_charged_at !== null || row.quota_released_at !== null) return false;
  for (const r of reserved) {
    await tx
      .updateTable('usage_counters')
      .set({ reserved: sql`greatest(reserved - 1, 0)`, updated_at: sql`now()` })
      .where('user_id', '=', row.user_id)
      .where('metric', '=', r.metric)
      .where('period_start', '=', sql<Date>`${r.periodStart}::date`)
      .execute();
  }
  await tx.updateTable('generations').set({ quota_released_at: sql`now()` }).where('id', '=', row.id).execute();
  return true;
}
