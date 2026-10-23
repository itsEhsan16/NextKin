import type { Education } from '@nextkin/shared/models';

import type { EducationAnswer } from './onboardingStore';

/** A qualification not yet on the profile. Not a UUID, so the API creates it. */
export function emptyEducation(): EducationAnswer {
  return {
    id: `edu_new_${Math.random().toString(36).slice(2, 10)}`,
    degree: '',
    school: '',
    year: null,
  };
}

/** The latest qualification: one still running, else the latest end. */
export function latestEducation(entries: readonly Education[]): Education | undefined {
  return [...entries].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return (b.endDate ?? b.startDate).localeCompare(a.endDate ?? a.startDate);
  })[0];
}

/** "B.Des, Interaction Design": the degree and its field, as ONB 07's one Degree field holds them. */
export function educationFromEntry(entry: Education): EducationAnswer {
  return {
    id: entry.id,
    degree: entry.field ? `${entry.degree}, ${entry.field}` : entry.degree,
    school: entry.institution,
    year: entry.endDate ? entry.endDate.slice(0, 4) : null,
  };
}

export const educationBlank = (answer: EducationAnswer) =>
  !answer.degree.trim() && !answer.school.trim() && answer.year == null;

/** Degree and school are what a qualification needs; the year may stay unknown. */
export const educationComplete = (answer: EducationAnswer) =>
  answer.degree.trim() !== '' && answer.school.trim() !== '';

/**
 * The profile entry an answer describes. The Degree field splits at its first comma into degree
 * and field. A year finished is stored as that year's last day, marked year-precise, so nothing
 * prints a month; an unchanged qualification and year keep the entry's full dates. Otherwise the
 * start date is blank: ONB 07 never asks for one.
 */
export function entryFromEducation(answer: EducationAnswer, existing?: Education): Education {
  const [degree = '', ...rest] = answer.degree.split(',');
  const field = rest.join(',').trim();
  const before = existing ? educationFromEntry(existing) : undefined;
  // A different degree or school is a different qualification: its old dates don't carry over.
  const same =
    before != null &&
    before.degree === answer.degree.trim() &&
    before.school === answer.school.trim();
  const keepEnd = same && existing?.endDate && existing.endDate.slice(0, 4) === answer.year;
  const end = keepEnd
    ? {
        endDate: existing.endDate,
        ...(existing.endPrecision ? { endPrecision: existing.endPrecision } : {}),
      }
    : answer.year
      ? { endDate: `${answer.year}-12-31`, endPrecision: 'year' as const }
      : {};
  return {
    id: answer.id,
    institution: answer.school.trim(),
    degree: degree.trim(),
    ...(field ? { field } : {}),
    startDate: same ? (existing?.startDate ?? '') : '',
    ...end,
    current: false,
  };
}

/** Whether saving the answer would change what the profile already holds. */
export function educationChanged(
  answer: EducationAnswer,
  existing: Education | undefined,
): boolean {
  if (!existing) return true;
  const before = educationFromEntry(existing);
  return (
    before.degree !== answer.degree.trim() ||
    before.school !== answer.school.trim() ||
    before.year !== answer.year
  );
}
