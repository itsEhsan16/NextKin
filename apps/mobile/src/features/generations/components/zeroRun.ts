import { ZERO_YEARS_LABEL, type Generation } from '@/data/models';

import type { TailorProgressRow } from './TailorProgress';

// ZERO 02 (613:293) copy.
export const ZERO_WRITING_TITLE = 'Writing your first draft';
export const ZERO_WRITING_LEDE =
  'About a minute. Leave anytime — we will let you know when it is ready.';
export const ZERO_CARD_TITLE = 'Writing your draft';
export const ZERO_FOOTNOTE = 'Anything we can’t know stays as a [blank] for you to fill in.';

/**
 * Where the four rows split the run. The board's 48% is "Writing your experience" (613:349), so
 * reading the role and planning the sections are the first third, and marking the guesses is the
 * last stretch, while the draft is checked.
 */
const PLANNING_FROM = 0.15;
const WRITING_FROM = 0.3;
const MARKING_FROM = 0.6;

function currentRow(generation: Generation): number {
  if (generation.status === 'ready') return 4;
  const { progress } = generation;
  if (progress < PLANNING_FROM) return 0;
  if (progress < WRITING_FROM) return 1;
  if (progress < MARKING_FROM) return 2;
  return 3;
}

/**
 * ZERO 02's checklist (613:338–613:353), in the run's own words: the role it looked at and the
 * years it planned for. Someone starting out has no experience to write, so that row says what is
 * written instead.
 */
export function zeroProgressRows(generation: Generation): TailorProgressRow[] {
  const role = generation.zero?.targetTitle?.trim();
  const band = generation.zero?.yearsBand;
  const starting = band === 'none';
  const labels = [
    role ? `Looked at ${role} roles` : 'Looked at the role you want',
    starting || !band
      ? 'Planned the sections of a first resume'
      : `Planned sections for ${ZERO_YEARS_LABEL[band]} years`,
    starting ? 'Writing your summary and skills' : 'Writing your experience',
    'Marking what you need to check',
  ];
  const current = currentRow(generation);
  return labels.map((label, index) => ({
    label,
    state: index < current ? 'done' : index === current ? 'current' : 'todo',
  }));
}
