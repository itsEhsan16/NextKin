import { COVER_LETTER_TONE_LABEL, ZERO_YEARS_LABEL, type Generation } from '@nextkin/shared/models';

/**
 * Each run's checklist while it works (toreview §125), in mobile's words (`zeroRun.ts`,
 * `coverRun.ts`, `atsRun.ts`), read off the run's progress so a line ticks as its share passes.
 */

export type RunLineState = 'done' | 'current' | 'todo';
export type RunLine = { label: string; state: RunLineState };

/** `splits` are where each line after the first starts, as a share of the run. */
function linesAt(
  generation: Generation,
  labels: readonly string[],
  splits: readonly number[],
): RunLine[] {
  const current =
    generation.status === 'ready'
      ? labels.length
      : splits.filter((from) => generation.progress >= from).length;
  return labels.map((label, index) => ({
    label,
    state: index < current ? 'done' : index === current ? 'current' : 'todo',
  }));
}

export function zeroLines(generation: Generation): RunLine[] {
  const role = generation.zero?.targetTitle?.trim();
  const band = generation.zero?.yearsBand;
  const starting = band === 'none';
  return linesAt(
    generation,
    [
      role ? `Looked at ${role} roles` : 'Looked at the role you want',
      starting || !band
        ? 'Planned the sections of a first resume'
        : `Planned sections for ${ZERO_YEARS_LABEL[band]} years`,
      starting ? 'Writing your summary and skills' : 'Writing your experience',
      'Marking what you need to check',
    ],
    [0.15, 0.3, 0.6],
  );
}

export function coverLines(generation: Generation): RunLine[] {
  const hasJob = generation.jobId != null || generation.jdId != null;
  const tone = COVER_LETTER_TONE_LABEL[generation.tone ?? 'professional'].toLowerCase();
  return linesAt(
    generation,
    [
      hasJob ? 'Read your resume and the job details' : 'Read your resume',
      'Picked your strongest points',
      `Writing in a ${tone} tone`,
      hasJob ? 'Fitting it to the role and company' : 'Fitting it to the role',
      'Finalising your cover letter',
    ],
    [0.25, 0.5, 0.75, 0.9],
  );
}

export function atsLines(generation: Generation): RunLine[] {
  return linesAt(
    generation,
    [
      'Reading your resume',
      'Understanding the job description',
      'Matching your skills and experience',
      'Checking layout, sections and dates',
      'Preparing your results',
    ],
    [0.2, 0.4, 0.6, 0.85],
  );
}
