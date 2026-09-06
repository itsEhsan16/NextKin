import type { InterviewSet, SubscriptionUsage } from '@/data/models';

/**
 * NextKin V2 spec §13.3 — "1 question set per generated resume" on Free — and §13.5, which wants
 * the cap in front of the reader before the work and the upsell replacing the action when it is
 * spent. Pure, on the `atsCheckSetup.ts` pattern, and it separates "unknown" from "spent".
 *
 * The cap is read off the sets that EXIST for the target, not off a flat counter: the fixture
 * account is at `interviewSetsUsed: 1 / interviewSetsLimit: 1`, and gating on that would put
 * `/interview/new` behind an upsell it could never clear — the `resumesUsed` trap logged in
 * `toreview.md`. Read per resume, the seeded Stripe set blocks only the Stripe resume.
 *
 * Standalone sets have no resume to be capped per; §13.3 does not cover them, so they share one
 * bucket under the same per-target limit. One rule, one function.
 */
export type InterviewAllowance = {
  /** False when the plan has not been read — unknown is not unlimited, and not spent either. */
  known: boolean;
  /** Sets already held for this target. */
  existing: number;
  /** The per-target cap. */
  perTarget: number;
  spent: boolean;
};

export function interviewAllowance(
  sets: readonly Pick<InterviewSet, 'resumeId' | 'source'>[],
  target: string | undefined,
  usage: Pick<SubscriptionUsage, 'interviewSetsLimit'> | undefined,
): InterviewAllowance {
  const perTarget = usage?.interviewSetsLimit;
  if (perTarget == null) return { known: false, existing: 0, perTarget: 0, spent: false };
  const existing = sets.filter((set) =>
    target ? set.resumeId === target : set.source === 'standalone',
  ).length;
  return { known: true, existing, perTarget, spent: perTarget > 0 && existing >= perTarget };
}

/** What the press costs, said on the bar before it is made. */
export const INTERVIEW_COST_NOTE = 'Writes a fresh set of questions. Earlier sets are kept.';

/**
 * §13.5 asks the upsell to show a reset date. There is none to show: this cap is per resume,
 * not per period, so it states the cap and what Pro does instead. It never says "resets".
 */
export const interviewSpentNote = (perTarget: number, target: 'resume' | 'standalone'): string =>
  target === 'resume'
    ? `Free includes ${perTarget === 1 ? 'one question set' : `${perTarget} question sets`} per resume. Pro regenerates as often as you like.`
    : `Free includes ${perTarget === 1 ? 'one generic set' : `${perTarget} generic sets`}. Pro regenerates as often as you like.`;

export const INTERVIEW_START_FAILED =
  "We couldn't start writing the questions. Check your connection and try again.";
