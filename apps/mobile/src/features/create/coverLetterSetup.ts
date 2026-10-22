import type { CoverLetterTone, Resume } from '@/data/models';
import { pluralize } from '@/lib';

/**
 * The rules and the copy behind the cover-letter intake (V2 §7.10).
 *
 * Pure, and kept out of the screen: "which documents can a letter be written from" is a fact
 * about the library rather than about the page that lists it, and the quota copy has to read the
 * same wherever it is said. The same split `generationQuota.ts` makes for the tailoring flow —
 * its notes are reused nowhere here because they are written in generations, and §13.3 meters
 * cover letters on their own allowance.
 */

/**
 * Picker order. §7.10 makes Professional the default, so it leads; the rest follow the model's
 * own declaration order rather than a second opinion about which tone is safest.
 */
export const COVER_LETTER_TONES: readonly CoverLetterTone[] = [
  'professional',
  'confident',
  'conversational',
  'concise',
];

/** §7.10's default: the tone a letter is written in unless the reader picks another. */
export const DEFAULT_COVER_LETTER_TONE: CoverLetterTone = 'professional';

/** The primary's label (COVER 01 644:82), shared with the inert copy the loading state pins. */
export const COVER_LETTER_CTA = 'Write my cover letter';

/**
 * COVER 01's title and lede (644:30 / 644:31). A resume tailored for no job (opened from the
 * resume menu) has no job details to promise, so the copy says only what the letter is made from.
 */
export function coverSetupHero(hasJob: boolean): { title: string; lede: string } {
  return hasJob
    ? {
        title: 'Cover letter for this job',
        lede: 'We’ll use your resume and the job details to create a tailored cover letter.',
      }
    : { title: 'Cover letter', lede: 'We’ll use your resume to create a cover letter.' };
}

/**
 * "1 of 1 cover letter left this month" (COVER 01 644:80) — the cap on the bar, over the button
 * that spends it, in `UsageBanner`'s wording so it reads the same as every other create screen.
 */
export const coverLetterQuotaNote = (used: number, limit: number): string =>
  `${Math.max(0, limit - used)} of ${pluralize(limit, 'cover letter')} left this month`;

/**
 * The resume row's meta on COVER 01 (644:50): "Tailored for this job · ATS score 88". A resume
 * tailored for no job (opened from the resume menu) says what it is instead; the score is left
 * out while the resume is unscored, never shown as a zero.
 */
export function coverResumeMeta(resume: Resume): string {
  const kind = resume.linkedJobId
    ? 'Tailored for this job'
    : [
        resume.isBase ? 'Base resume' : 'Tailored',
        resume.pageCount != null ? pluralize(resume.pageCount, 'page') : undefined,
      ]
        .filter(Boolean)
        .join(' · ');
  return [kind, resume.atsScore != null ? `ATS score ${resume.atsScore}` : undefined]
    .filter(Boolean)
    .join(' · ');
}

/**
 * §7.10 forbids a silent hang. The reason goes on the bar that started the work, and the button
 * stays live so a second press is the retry.
 */
export const COVER_LETTER_START_FAILED =
  "We couldn't start it. Check your connection and try again.";

/**
 * What the bar says once the allowance is gone. Free grants exactly one, so the count leads with
 * the verb rather than trailing it — "This month's 1 cover letter are used" is not a sentence,
 * and neither is the 0 of 0 a plan that grants none would produce.
 */
export const coverLetterSpentNote = (limit: number): string =>
  limit > 0
    ? `You've used this month's ${pluralize(limit, 'cover letter')}. Pro raises the monthly cap.`
    : 'Your plan has no cover letters this month. Pro raises the monthly cap.';

/**
 * The documents a letter can be written from.
 *
 * §7.10 writes a letter against a resume VERSION and the job it was tailored to, so all three
 * conditions are load-bearing: a cover letter is not a source for another cover letter, a resume
 * with no linked job leaves the letter nothing to address, and a run still in flight has no
 * finished version to read. Order is the library's own (most recently updated first), so the
 * document the user just worked on is the one the screen preselects.
 */
export function coverLetterSources(resumes: readonly Resume[]): Resume[] {
  return resumes.filter(
    (resume) =>
      resume.docType === 'resume' && resume.linkedJobId != null && resume.status === 'ready',
  );
}

/**
 * The source the screen opens on: the one asked for by route param when it still qualifies,
 * otherwise the most recent candidate. `undefined` means there is nothing to write from and the
 * screen shows its empty state instead.
 */
export function pickCoverLetterSource(
  sources: readonly Resume[],
  preferredId?: string,
): Resume | undefined {
  return sources.find((resume) => resume.id === preferredId) ?? sources[0];
}
