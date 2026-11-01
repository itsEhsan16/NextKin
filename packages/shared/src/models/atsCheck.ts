import { ATS_BAND_LABEL, type AtsBand, type AtsReport } from './resume';

/**
 * The ATS check for a resume made outside NextKin (V2 §7.8, toreview §73): one file measured
 * against one job — a saved job or a pasted description. These are the result's shapes and the
 * copy decisions ATS 03 draws, so the run screen and the result read the same rules.
 */

/** What ATS 03's "Fix these" can say (646:91). Each is a change the user can make, never a score. */
export type AtsCheckFixKey = 'columns' | 'summary' | 'results' | 'length';

export type AtsCheckFix = { key: AtsCheckFixKey; title: string; detail: string };

/** One check's outcome, kept on the run that produced it. */
export type AtsCheckResult = {
  /** 0–100 against NextKin's own rubric for this job — a measurement, not a prediction (§7.8). */
  score: number;
  band: AtsBand;
  /** "Stripe", when the job names one; a pasted description may not. */
  company?: string;
  jobTitle?: string;
  /** What the job asks for that the resume does not show, in the job's order. */
  missing: string[];
  /** The most useful changes, at most three. */
  fixes: AtsCheckFix[];
  /** What the number rests on (toreview §146.1). A check run before §146 has none. */
  report?: Pick<AtsReport, 'jdMatch' | 'components' | 'notMeasured'>;
};

/** "Fair for Stripe’s job" — or "for this job" when the description names no company. */
export const atsCheckTitle = (result: Pick<AtsCheckResult, 'band' | 'company'>): string =>
  `${ATS_BAND_LABEL[result.band]} for ${result.company ? `${result.company}’s job` : 'this job'}`;

/** The line under the title (646:59), one per band. */
export const ATS_CHECK_LEDE: Record<AtsBand, string> = {
  strong: 'Your resume covers most of what the job asks for. A few small changes are left.',
  good: 'Your resume covers a good part of what the job asks for, with a little room to improve.',
  fair: 'Your resume covers some of what the job asks for, with clear room to improve.',
  weak: 'Your resume covers little of what the job asks for yet. The fixes below will help most.',
};
