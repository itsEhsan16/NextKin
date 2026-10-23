import type { Generation } from '@/data/models';

import type { TailorProgressRow } from './TailorProgress';

// ATS 02 (646:2) copy.
export const ATS_CHECKING_TITLE = 'Checking your resume';
export const ATS_CHECKING_LEDE = 'This usually takes less than 30 seconds.';

/** "Checking against Stripe’s job" (646:19), or the description when it names no company. */
export const atsCheckingCardTitle = (company?: string) =>
  company ? `Checking against ${company}’s job` : 'Checking against the job description';

/** Where the five rows split the run; the board's 55% is "Matching your skills" (646:38). */
const STEPS = [0.2, 0.4, 0.6, 0.85] as const;

const LABELS = [
  'Reading your resume',
  'Understanding the job description',
  'Matching your skills and experience',
  'Checking layout, sections and dates',
  'Preparing your results',
] as const;

/** ATS 02's checklist (646:25–646:46), read off the run's progress. */
export function atsProgressRows(generation: Generation): TailorProgressRow[] {
  const current =
    generation.status === 'ready'
      ? LABELS.length
      : STEPS.filter((from) => generation.progress >= from).length;
  return LABELS.map((label, index) => ({
    label,
    state: index < current ? 'done' : index === current ? 'current' : 'todo',
  }));
}
