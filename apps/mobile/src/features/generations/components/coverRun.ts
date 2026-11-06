import { COVER_LETTER_TONE_LABEL, type CoverLetterTone, type Generation } from '@/data/models';

import type { TailorProgressRow } from './TailorProgress';

/** §7.10's default, and what the repo writes in when a run was started without a tone. */
export const DEFAULT_TONE: CoverLetterTone = 'professional';

const TONES = Object.keys(COVER_LETTER_TONE_LABEL) as CoverLetterTone[];

export const runTone = (generation: Generation): CoverLetterTone => generation.tone ?? DEFAULT_TONE;

/** COVER 03's tone buttons: every tone but the one this draft is in, in the setup screen's order. */
export const otherTones = (tone: CoverLetterTone): CoverLetterTone[] =>
  TONES.filter((other) => other !== tone);

// COVER 02 (644:84) copy.
export const COVER_WRITING_TITLE = 'Writing your cover letter';
export const COVER_CARD_TITLE = 'Writing your letter';
export const COVER_HONESTY_NOTE = 'Nothing goes in the letter that isn’t on your resume.';

/** COVER 02's lede (644:113). Without a job there are no job details to read. */
export const coverWritingLede = (hasJob: boolean) =>
  hasJob
    ? 'Writing from your resume and the job.'
    : 'Writing from your resume.';

/**
 * Where the five rows split the pipeline's four working statuses. `generating` covers reading
 * and picking the points, `scoring` covers fitting and finishing, so the second half of each
 * hands over to the next row. The mock steps 0.15 a tick, so every row is current at least once.
 */
const PICKING_FROM = 0.25;
const FINALISING_FROM = 0.9;

function currentRow(generation: Generation): number {
  switch (generation.status) {
    case 'queued':
      return 0;
    case 'generating':
      return generation.progress < PICKING_FROM ? 0 : 1;
    case 'validating':
      return 2;
    case 'scoring':
      return generation.progress < FINALISING_FROM ? 3 : 4;
    case 'ready':
      return 5;
    default:
      return 0;
  }
}

/**
 * COVER 02's checklist (644:123–644:142), read off the pipeline: the board's 70% is the draft
 * being validated, written in the run's own tone. A letter written without a job reads the
 * resume alone and fits the letter to the role it names.
 */
export function coverProgressRows(generation: Generation): TailorProgressRow[] {
  const hasJob = generation.jobId != null;
  const labels = [
    hasJob ? 'Read your resume and the job details' : 'Read your resume',
    'Picked your strongest points',
    `Writing in a ${COVER_LETTER_TONE_LABEL[runTone(generation)].toLowerCase()} tone`,
    hasJob ? 'Fitting it to the role and company' : 'Fitting it to the role',
    'Finalising your cover letter',
  ];
  const current = currentRow(generation);
  return labels.map((label, index) => ({
    label,
    state: index < current ? 'done' : index === current ? 'current' : 'todo',
  }));
}

/**
 * COVER 03's lede (644:177): "A tailored cover letter for the Senior Product Designer role at
 * Stripe." Without a job it says where the letter came from instead.
 */
export function coverReadyLede(job?: { title: string; company: string }, resumeTitle?: string) {
  if (job) return `A tailored cover letter for the ${job.title} role at ${job.company}.`;
  return resumeTitle
    ? `Written only from your “${resumeTitle}” resume.`
    : 'Written only from your resume.';
}
