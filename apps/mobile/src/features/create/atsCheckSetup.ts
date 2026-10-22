import type { SubscriptionUsage } from '@/data/models';
import { pluralize } from '@/lib';

/**
 * The rules and the copy behind ATS 01 / 01b (V2 §7.8, toreview §73): a resume made outside
 * NextKin, checked against a saved job or a pasted description. Pure, so the screen only renders
 * and "is there enough here to check" is tested without mounting it.
 */

/** Against a saved job (ATS 01) or a pasted description (ATS 01b). */
export type AtsJobMode = 'job' | 'paste';

/**
 * This month's ATS-check allowance. Both meter fields are optional on `SubscriptionUsage`, and an
 * absent cap is UNKNOWN rather than exhausted: §13.5 asks for the cap in front of the user before
 * the work, so a cap the app never read must not silently turn into a paywall. A published cap of
 * zero is a different thing — a plan that grants none is spent from the first press.
 */
export type AtsCheckAllowance = { known: boolean; used: number; limit: number; spent: boolean };

export function atsCheckAllowance(
  usage: Pick<SubscriptionUsage, 'atsChecksUsed' | 'atsChecksLimit'> | undefined,
): AtsCheckAllowance {
  const used = usage?.atsChecksUsed;
  const limit = usage?.atsChecksLimit;
  if (used === undefined || limit === undefined) {
    return { known: false, used: 0, limit: 0, spent: false };
  }
  return { known: true, used, limit, spent: used >= limit };
}

/** The primary's label (645:47), shared with the inert copy the loading state pins. */
export const ATS_CTA = 'Check my resume';
export const UPGRADE_CTA = 'See Pro plans';

export const ATS_TITLE = 'Check your resume';
/** 645:16 and 645:62: what this check is for, by where the job comes from. */
export const ATS_LEDE: Record<AtsJobMode, string> = {
  job: 'See how a resume made outside NextKin reads for a job.',
  paste: 'We’ll check your resume against this job description.',
};

/** "2 of 3 checks left this month" (645:45), over the button that spends one (§13.5). */
export const atsChecksLeftNote = (used: number, limit: number): string =>
  `${Math.max(0, limit - used)} of ${pluralize(limit, 'check')} left this month`;

/** What the bar says once the allowance is gone; a plan granting none reaches this too. */
export const atsChecksSpentNote = (limit: number): string =>
  limit > 0
    ? `You’ve used this month’s ${pluralize(limit, 'check')}. Pro raises the monthly cap.`
    : 'Your plan has no ATS checks this month. Pro raises the monthly cap.';

/** The pasted description's cap and the least that is worth reading (645:80 "284 / 2000"). */
export const JD_MAX = 2000;
export const JD_MIN = 80;

/** The tip under the pasted description (645:89). */
export const PASTE_TIP =
  'Paste the whole description. The more of it we read, the truer the result.';

export const NEED_FILE = 'Upload your resume to check it.';
export const NEED_JOB = 'Pick a saved job, or paste a job description.';
export const PASTE_SHORT = 'Paste a little more of the description, a few lines at least.';
export const CHECK_FAILED = "We couldn't start the check. Check your connection and try again.";

/** What still stands between the reader and a check, in the order they fill the page in. */
export function atsBlocker(input: {
  hasFile: boolean;
  mode: AtsJobMode;
  hasJob: boolean;
  pasted: string;
}): string | undefined {
  if (!input.hasFile) return NEED_FILE;
  if (input.mode === 'job') return input.hasJob ? undefined : NEED_JOB;
  return input.pasted.trim().length < JD_MIN ? PASTE_SHORT : undefined;
}
