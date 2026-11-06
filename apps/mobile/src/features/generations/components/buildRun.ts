import { ATS_BAND_LABEL, atsBandFor, type AtsBand, type Generation } from '@/data/models';

import type { TailorProgressRow } from './TailorProgress';

// BUILD 05 (653:124) copy. The wait itself is said once, in the "Almost there" card.
export const BUILD_LEDE = 'Matching your experience to the job.';
export const BUILD_CARD_TITLE = 'Writing your resume';

export const buildProgressTitle = (company?: string) =>
  company ? `Building for ${company}` : 'Building your resume';

const LABELS = [
  'Read the job description',
  'Matched your experience',
  'Writing your resume',
  'Checking the ATS score',
] as const;

/** Generating's first stretch is the matching; past this share of the run, it is writing. */
const MATCHED_BY = 0.3;

/**
 * BUILD 05's checklist, read off the pipeline's status: queued reads the job; generating first
 * matches the experience, then writes; validating and scoring are the ATS check. (Generating
 * used to jump straight to the writing row, so "Matched your experience" was never seen working.)
 */
export function buildProgressRows(generation: Generation): TailorProgressRow[] {
  const { status, progress } = generation;
  const current =
    status === 'ready'
      ? LABELS.length
      : status === 'queued'
        ? 0
        : status === 'generating'
          ? progress < MATCHED_BY
            ? 1
            : 2
          : LABELS.length - 1;
  return LABELS.map((label, index) => ({
    label,
    state: index < current ? 'done' : index === current ? 'current' : 'todo',
  }));
}

/**
 * BUILD 06's pill names the band of the new score ("Strong match", 599:42), on the score's own
 * published thresholds — never "Up from", since a build has no earlier score to rise from.
 */
export const buildBand = (score: number): AtsBand => atsBandFor(score);
export const buildBandLabel = (band: AtsBand) => `${ATS_BAND_LABEL[band]} match`;
