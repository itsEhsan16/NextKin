import type { GenerationInput, JdInput, User } from '@/data/models';

/**
 * NextKin V2 spec §7.9 (Zero Resume Mode) — the rules and the guardrail copy behind the intake,
 * with no React in them.
 *
 * The screen holds its four fields in `useState`; everything that *decides* something about them
 * — whether they are enough to start a run, what the pipeline is seeded with, what the page
 * promises about the draft — lives here, so it is unit tested without rendering a page. The same
 * split as `jdSkillEdits.ts` and `resumes/sectionEdits.ts`. No react-hook-form and no zod: four
 * fields and one number range are the product's rules, not a schema library's.
 */

export type Validation = { ok: true } | { ok: false; errors: Record<string, string> };

/** What the form holds. Years is text because a text field is what the reader types into. */
export type ZeroResumeDraft = {
  fullName: string;
  yearsExperience: string;
  targetTitle: string;
  location: string;
};

/** The pipeline's Zero Resume seed (V2 §7.9), named off the model so the two cannot drift. */
export type ZeroSeed = NonNullable<GenerationInput['zero']>;

export const emptyZeroResumeDraft: ZeroResumeDraft = {
  fullName: '',
  yearsExperience: '',
  targetTitle: '',
  location: '',
};

/** Field caps. The name is a resume header line; the title and city are one line each. */
export const NAME_MAX = 80;
export const TITLE_MAX = 80;
export const LOCATION_MAX = 80;

/**
 * The top of the accepted range. Not a judgement about anyone's career: past this the number is
 * far likelier to be a typo than a working life, and the pipeline builds a role scaffold out of
 * it (§7.9), so an unbounded figure would scaffold an unbounded resume.
 */
export const YEARS_MAX = 60;

/* --------------------------------------------------------------- guardrail */

/**
 * The §7.9 guardrail, verbatim. It is a constant rather than copy typed into the card because
 * this is the one promise the whole feature rests on — "the product's mechanics enforce this" —
 * and a test pins it so nobody softens it into marketing later.
 */
export const ZERO_RESUME_GUARDRAIL_TITLE = 'This draft will be full of blanks on purpose';

export const ZERO_RESUME_GUARDRAIL_BODY =
  'We only know what you type on this page. Everything else is left as a placeholder for you to ' +
  'fill in: roles come out as [Company Name], schools as [Institution], and dates as ranges we ' +
  'worked out from your years of experience. Nothing is invented as fact — no employer, no ' +
  'credential, no skill you did not tell us about. Every assumed line is marked "needs review", ' +
  'and the draft cannot be downloaded until you have replaced or confirmed each one.';

/* -------------------------------------------------------------- validation */

const verdict = (errors: Record<string, string>): Validation =>
  Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };

/**
 * The typed years as a number, or null when the text is not a plain count of years. Whole digits
 * only: "3.5" and "about 4" are answers to a different question, and the scaffold divides the
 * figure into roles.
 */
export function parseYears(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const years = Number(trimmed);
  return Number.isFinite(years) ? years : null;
}

/**
 * What the form has to say before a run can start (V2 §7.9: name + years of experience + a JD).
 * Zero is a valid, expected answer here — this feature exists for the person who has never had a
 * job — so an empty field and a typed 0 are told apart rather than both read as "missing".
 */
export function validateZeroResume(draft: ZeroResumeDraft): Validation {
  const errors: Record<string, string> = {};

  const name = draft.fullName.trim();
  if (name.length === 0) errors.fullName = 'Add the name you want printed on the resume.';
  else if (name.length > NAME_MAX) {
    errors.fullName = `That name is ${name.length} characters. Keep it under ${NAME_MAX}.`;
  }

  const years = draft.yearsExperience.trim();
  if (years.length === 0) {
    errors.yearsExperience =
      'Tell us how many years you have worked. Type 0 if you are starting out.';
  } else {
    const parsed = parseYears(years);
    if (parsed === null)
      errors.yearsExperience = 'Write this as whole years in digits — 0, 2 or 15.';
    else if (parsed > YEARS_MAX) {
      errors.yearsExperience = `${YEARS_MAX} years is the most we can build a draft from.`;
    }
  }

  if (draft.targetTitle.trim().length > TITLE_MAX) {
    errors.targetTitle = `Keep the job title under ${TITLE_MAX} characters.`;
  }
  if (draft.location.trim().length > LOCATION_MAX) {
    errors.location = `Keep the location under ${LOCATION_MAX} characters.`;
  }

  return verdict(errors);
}

/**
 * Whether the job description is usable yet. §7.9 lists a confirmed JD extraction among the three
 * inputs, so this flow cannot start without one: a pasted description that is only whitespace is
 * not a description, and a saved job the app could not read is not one either.
 */
export const jdIsReady = (jd: JdInput | null, jobResolved: boolean): boolean =>
  jd != null &&
  (jd.source !== 'paste' || jd.text.trim().length > 0) &&
  (jd.source !== 'job' || jobResolved);

/* --------------------------------------------------------------- the seed */

/**
 * The seed handed to the pipeline. Trimmed, and the two optional fields are omitted rather than
 * sent as empty strings: the repo names the shell document after `targetTitle` when it has one,
 * and an empty string there would title a document "".
 *
 * Call it on a draft that has passed `validateZeroResume` — the years fall back to 0, which is
 * the honest reading of a field this feature expects people to leave at zero.
 */
export function zeroSeed(draft: ZeroResumeDraft): ZeroSeed {
  const targetTitle = draft.targetTitle.trim();
  const location = draft.location.trim();
  return {
    fullName: draft.fullName.trim(),
    yearsExperience: parseYears(draft.yearsExperience) ?? 0,
    ...(targetTitle ? { targetTitle } : {}),
    ...(location ? { location } : {}),
  };
}

/** The prefill for the name field — still editable, because the resume's name is the user's call. */
export const fullNameOf = (user: Pick<User, 'firstName' | 'lastName'>): string =>
  [user.firstName, user.lastName]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ');
