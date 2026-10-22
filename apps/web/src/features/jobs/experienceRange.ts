import type { ExperienceLevel, Job } from '@nextkin/shared/models';

/**
 * Year ranges for a listing that states none. The board's own "3–5 years" (304:2479) is the
 * listing's `experienceYears`; these bands are the fallback for the rest of the catalogue, where
 * `ExperienceLevel` is all the model knows. A judgement call, not given anywhere — see
 * `toreview.md` §15.1.
 */
export const EXPERIENCE_LEVEL_RANGE_LABEL: Record<ExperienceLevel, string> = {
  entry: '0–2 years',
  mid: '2–5 years',
  senior: '5–8 years',
  lead: '8+ years',
};

/** "3–5 years" — the listing's own range when it states one, else its band's. */
export function experienceLabel(job: Pick<Job, 'experienceLevel' | 'experienceYears'>): string {
  const years = job.experienceYears;
  return years
    ? `${years.min}–${years.max} years`
    : EXPERIENCE_LEVEL_RANGE_LABEL[job.experienceLevel];
}
