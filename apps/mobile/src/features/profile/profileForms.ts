/**
 * NextKin V2 §7.3 — the rules behind the four profile entry forms (a role, a degree, a
 * credential, a link), with no React in them.
 *
 * Each screen holds a draft in `useState`; everything that *decides* something about that draft —
 * whether it is valid, whether it still matches what was loaded — lives here, so it is unit
 * tested without rendering a page. The same split as `resumes/sectionEdits.ts` and
 * `create/jdSkillEdits.ts`. No react-hook-form and no zod: an entry is a handful of fields and
 * the rules are the product's, not a schema library's.
 *
 * The draft shapes and what leaves them on Save are next door in `profileDrafts`, re-exported
 * here so a caller only ever imports one module.
 */
import {
  looksLikeUrl,
  type CertificationDraft,
  type EducationDraft,
  type ExperienceDraft,
  type LinkDraft,
} from './profileDrafts';

export * from './profileDrafts';

export type Validation = { ok: true } | { ok: false; errors: Record<string, string> };

const blank = (value: string): boolean => value.trim().length === 0;

const verdict = (errors: Record<string, string>): Validation =>
  Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };

/** Profile dates are ISO months pinned to the first, so they sort as plain strings. */
const endsBeforeStart = (start: string, end: string): boolean =>
  start.length > 0 && end.length > 0 && end < start;

/** Said in words rather than "invalid", and said the same way on every form. */
const NOT_A_URL = "That doesn't look like a web address.";

/* ------------------------------------------------------------- validation */

export function validateExperience(draft: ExperienceDraft): Validation {
  const errors: Record<string, string> = {};
  if (blank(draft.company)) errors.company = 'Add the company name.';
  if (blank(draft.title)) errors.title = 'Add your job title.';
  // A role someone still holds has no end date to be wrong about.
  if (!draft.current && endsBeforeStart(draft.startDate, draft.endDate)) {
    errors.endDate = 'The end date is before the start date.';
  }
  return verdict(errors);
}

export function validateEducation(draft: EducationDraft): Validation {
  const errors: Record<string, string> = {};
  if (blank(draft.institution)) errors.institution = 'Add the school or university.';
  if (blank(draft.degree)) errors.degree = 'Add the qualification.';
  if (!draft.current && endsBeforeStart(draft.startDate, draft.endDate)) {
    errors.endDate = 'The end date is before the start date.';
  }
  return verdict(errors);
}

export function validateCertification(draft: CertificationDraft): Validation {
  const errors: Record<string, string> = {};
  if (blank(draft.name)) errors.name = 'Add the certification name.';
  if (blank(draft.issuer)) errors.issuer = 'Add who issued it.';
  if (endsBeforeStart(draft.issuedOn, draft.expiresOn)) {
    errors.expiresOn = 'The expiry date is before the issue date.';
  }
  if (!blank(draft.credentialUrl) && !looksLikeUrl(draft.credentialUrl)) {
    errors.credentialUrl = NOT_A_URL;
  }
  return verdict(errors);
}

export function validateLink(draft: LinkDraft): Validation {
  const errors: Record<string, string> = {};
  if (blank(draft.label)) errors.label = 'Add a name for this link.';
  if (blank(draft.url)) errors.url = 'Add the web address.';
  else if (!looksLikeUrl(draft.url)) errors.url = NOT_A_URL;
  return verdict(errors);
}

/* ----------------------------------------------------------- role skills */

/** Appended, or the reason it was refused — a duplicate is never silently dropped. */
export type AddSkillResult = { skills: string[] } | { refused: string };

export function addRoleSkill(skills: readonly string[], value: string): AddSkillResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { refused: 'Type a skill first.' };
  if (skills.some((skill) => skill.toLowerCase() === trimmed.toLowerCase())) {
    return { refused: `${trimmed} is already on this role.` };
  }
  return { skills: [...skills, trimmed] };
}

export const removeRoleSkill = (skills: readonly string[], value: string): string[] =>
  skills.filter((skill) => skill !== value);

/* ------------------------------------------------------------------ dirty */

/**
 * Whether the draft still matches what was loaded, over the flat shapes above: strings, booleans
 * and one list of strings. `dirty` gates Save and the discard question, so it has to be exact —
 * a deep clone that happens to hold the same values must read as unchanged.
 */
export function sameDraft<T extends Record<string, unknown>>(a: T, b: T): boolean {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const left = a[key];
    const right = b[key];
    if (Array.isArray(left) || Array.isArray(right)) {
      const first: unknown[] = Array.isArray(left) ? left : [];
      const second: unknown[] = Array.isArray(right) ? right : [];
      if (first.length !== second.length) return false;
      if (first.some((item, index) => item !== second[index])) return false;
    } else if (left !== right) return false;
  }
  return true;
}
