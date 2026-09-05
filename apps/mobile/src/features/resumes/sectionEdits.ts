import type { ContentEducation, ContentProject, ContentRole } from '@/data/models';

import type { SectionDraft } from './sectionDrafts';

/**
 * NextKin V2 spec §7.11 (the structured section editor) and §7.10 (the letter body) — the rules
 * behind the section editor, with no React in them.
 *
 * The screen holds a draft in `useState`; everything that *decides* something about that draft —
 * whether it is valid, what a list looks like after an add, a remove or a move — lives here, so
 * it is unit tested without rendering a page. The same split as `create/jdSkillEdits.ts` and
 * `MonthYearSheet/monthYearMath.ts`. No react-hook-form and no zod: a section is a handful of
 * fields and the rules are the product's, not a schema library's.
 *
 * The draft's shape and what leaves it on Save are next door in `sectionDrafts`, re-exported here
 * so a caller only ever imports one module.
 */
export * from './sectionDrafts';

export type Validation = { ok: true } | { ok: false; errors: Record<string, string> };

/** The summary field's cap, shared by the counter on the field and the rule below it. */
export const SUMMARY_MAX = 600;

const blank = (value: string): boolean => value.trim().length === 0;

const verdict = (errors: Record<string, string>): Validation =>
  Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };

/* ------------------------------------------------------------------ lists */

export const removeAt = <T>(list: readonly T[], index: number): T[] =>
  list.filter((_, i) => i !== index);

export const replaceAt = <T>(list: readonly T[], index: number, entry: T): T[] =>
  list.map((item, i) => (i === index ? entry : item));

/** Reorders one entry. An out-of-range move is a no-op rather than a hole in the list. */
export function moveEntry<T>(list: readonly T[], from: number, to: number): T[] {
  const moved = list[from];
  if (moved === undefined || from === to || to < 0 || to >= list.length) return [...list];
  const rest = list.filter((_, i) => i !== from);
  return [...rest.slice(0, to), moved, ...rest.slice(to)];
}

/** Appended, or the reason it was refused — a duplicate is never silently dropped. */
export type AddEntryResult = { entries: string[] } | { refused: string };

export function addEntry(entries: readonly string[], value: string, noun: string): AddEntryResult {
  const trimmed = value.trim();
  if (!trimmed) return { refused: `Type a ${noun} first.` };
  if (entries.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) {
    return { refused: `${trimmed} is already in this list.` };
  }
  return { entries: [...entries, trimmed] };
}

export const removeEntry = (entries: readonly string[], value: string): string[] =>
  entries.filter((entry) => entry !== value);

/* ---------------------------------------------------------------- bullets */

type Bulleted = { bullets: string[] };

export const addBullet = <T extends Bulleted>(entry: T): T => ({
  ...entry,
  bullets: [...entry.bullets, ''],
});

export const removeBullet = <T extends Bulleted>(entry: T, index: number): T => ({
  ...entry,
  bullets: removeAt(entry.bullets, index),
});

export const setBullet = <T extends Bulleted>(entry: T, index: number, text: string): T => ({
  ...entry,
  bullets: replaceAt(entry.bullets, index, text),
});

/* --------------------------------------------------------------- new rows */

// The repo stores whatever id the draft carries, so a row added here needs one of its own. Not
// `newId` from the mock: that lives behind the data layer and screens never reach into it.
let sequence = 0;
export const draftEntryId = (prefix: string): string =>
  `${prefix}_draft_${Date.now().toString(36)}_${(sequence += 1)}`;

/** A new row starts with one empty bullet, so the shape of the thing to fill in is visible. */
export const newRole = (): ContentRole => ({
  id: draftEntryId('role'),
  company: '',
  title: '',
  period: '',
  bullets: [''],
});

export const newProject = (): ContentProject => ({
  id: draftEntryId('proj'),
  name: '',
  description: '',
  bullets: [''],
});

export const newEducation = (): ContentEducation => ({
  id: draftEntryId('edu'),
  institution: '',
  degree: '',
  period: '',
});

/* ------------------------------------------------------------- validation */

const requireText = (
  errors: Record<string, string>,
  key: string,
  value: string,
  message: string,
): void => {
  if (blank(value)) errors[key] = message;
};

/**
 * The rules a section has to pass before it can be saved. Empty lists are deliberately valid: a
 * document with no projects is a document with no projects, and the editor's empty state is the
 * add affordance itself rather than a refusal.
 */
export function validateSection(draft: SectionDraft): Validation {
  const errors: Record<string, string> = {};
  switch (draft.section) {
    case 'summary':
      if (blank(draft.value)) errors.summary = 'Write a summary, or go back without saving.';
      else if (draft.value.length > SUMMARY_MAX) {
        errors.summary = `That is ${draft.value.length} characters. Keep it under ${SUMMARY_MAX}.`;
      }
      break;
    case 'skills':
    case 'certifications':
      break;
    case 'experience':
      draft.value.forEach((role) => {
        requireText(errors, `${role.id}.title`, role.title, 'A role needs a job title.');
        requireText(errors, `${role.id}.company`, role.company, 'A role needs an employer.');
        requireText(errors, `${role.id}.period`, role.period, 'A role needs its dates.');
        role.bullets.forEach((bullet, index) => {
          requireText(errors, `${role.id}.bullet.${index}`, bullet, 'Write it or remove it.');
        });
      });
      break;
    case 'projects':
      draft.value.forEach((project) => {
        requireText(errors, `${project.id}.name`, project.name, 'A project needs a name.');
        project.bullets.forEach((bullet, index) => {
          requireText(errors, `${project.id}.bullet.${index}`, bullet, 'Write it or remove it.');
        });
      });
      break;
    case 'education':
      draft.value.forEach((entry) => {
        const where = entry.id;
        requireText(errors, `${where}.institution`, entry.institution, 'An entry needs a school.');
        requireText(errors, `${where}.degree`, entry.degree, 'An entry needs a qualification.');
        requireText(errors, `${where}.period`, entry.period, 'An entry needs its dates.');
      });
      break;
    case 'letter':
      requireText(errors, 'greeting', draft.value.greeting, 'A letter needs an opening line.');
      requireText(errors, 'signoff', draft.value.signoff, 'A letter needs a sign-off.');
      if (draft.value.paragraphs.every(blank)) errors.paragraphs = 'Write at least one paragraph.';
      break;
  }
  return verdict(errors);
}
