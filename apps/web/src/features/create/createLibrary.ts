import {
  ZERO_YEARS_VALUE,
  type Resume,
  type SubscriptionUsage,
  type User,
  type ZeroSeed,
  type ZeroYears,
} from '@nextkin/shared/models';
import type { Route } from 'next';

/**
 * The rules and copy behind web's Quick Start flows (toreview §125): Zero Resume, Cover Letter and
 * ATS Check, ported from mobile's `zeroResume.ts`, `coverLetterSetup.ts`, `atsCheckSetup.ts` and
 * `generationQuota.ts` so both apps say the same thing. Pure, so it is tested without a screen.
 */

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

/** Where each flow lives; `run` reopens a started run on its progress or result. */
export type CreateFlow = 'zero-resume' | 'cover-letter' | 'ats-check';
export function createHref(
  flow: CreateFlow,
  query: Record<string, string | undefined> = {},
): Route {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const search = params.toString();
  return `/create/${flow}${search ? `?${search}` : ''}` as Route;
}

/* ------------------------------------------------------------ allowances */

export type Allowance = { known: boolean; used: number; limit: number; spent: boolean };

/** An absent cap is unknown, not spent (§13.5); a cap of zero is spent from the first press. */
export function allowanceOf(used: number | undefined, limit: number | undefined): Allowance {
  if (used === undefined || limit === undefined)
    return { known: false, used: 0, limit: 0, spent: false };
  return { known: true, used, limit, spent: used >= limit };
}

const leftNote = (a: Allowance, word: string) =>
  `${Math.max(0, a.limit - a.used)} of ${plural(a.limit, word)} left this month`;
const spentNote = (a: Allowance, word: string, none: string) =>
  a.limit > 0
    ? `You’ve used this month’s ${plural(a.limit, word)}. Pro raises the monthly cap.`
    : `Your plan has no ${none} this month. Pro raises the monthly cap.`;

/** The line beside the button that spends one: what is left, or that it is gone. */
export function allowanceNote(a: Allowance, word: string, none: string): string | undefined {
  if (!a.known) return undefined;
  return a.spent ? spentNote(a, word, none) : leftNote(a, word);
}

export const generationAllowance = (u?: SubscriptionUsage) =>
  allowanceOf(u?.generationsUsed, u?.generationsLimit);
export const coverAllowance = (u?: SubscriptionUsage) =>
  allowanceOf(u?.coverLettersUsed, u?.coverLettersLimit);
export const atsAllowance = (u?: SubscriptionUsage) =>
  allowanceOf(u?.atsChecksUsed, u?.atsChecksLimit);

/* ------------------------------------------------------------ zero resume */

export type ZeroAbout = { fullName: string; years: ZeroYears | null; role: string };
export const emptyZeroAbout: ZeroAbout = { fullName: '', years: null, role: '' };
export const NAME_MAX = 80;
export const ROLE_MAX = 80;
export type ZeroAboutErrors = Partial<Record<keyof ZeroAbout, string>>;

/** "Tell us three things": each is needed, and the two text fields have a length. */
export function validateZeroAbout(about: ZeroAbout): ZeroAboutErrors {
  const errors: ZeroAboutErrors = {};
  const name = about.fullName.trim();
  if (!name) errors.fullName = 'Add the name you want printed on the resume.';
  else if (name.length > NAME_MAX) errors.fullName = `Keep the name under ${NAME_MAX} characters.`;
  if (about.years == null) errors.years = 'Pick how long you have worked. None is a fine answer.';
  const role = about.role.trim();
  if (!role) errors.role = 'Add the role you want, like Product Designer.';
  else if (role.length > ROLE_MAX) errors.role = `Keep the role under ${ROLE_MAX} characters.`;
  return errors;
}

export function zeroSeedFrom(about: ZeroAbout): ZeroSeed {
  const band = about.years ?? 'none';
  return {
    fullName: about.fullName.trim(),
    yearsBand: band,
    yearsExperience: ZERO_YEARS_VALUE[band],
    targetTitle: about.role.trim(),
  };
}

export const fullNameOf = (user: Pick<User, 'firstName' | 'lastName'>): string =>
  [user.firstName, user.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');

/* ----------------------------------------------------------- cover letter */

/**
 * What a letter can be written from (§7.10): a finished resume tailored for a job. A letter is not
 * a source for another letter, and a resume tailored for nothing leaves it nothing to address. On
 * the web most resumes are tailored to a pasted description, which links no listing, so a
 * tailored variant counts too; the server reads its JD from the resume (toreview §125).
 */
export const coverLetterSources = (resumes: readonly Resume[]): Resume[] =>
  resumes.filter(
    (r) =>
      r.docType === 'resume' &&
      r.status === 'ready' &&
      !r.archived &&
      (r.linkedJobId != null || r.variant === 'tailored'),
  );

export const pickCoverLetterSource = (sources: readonly Resume[], preferredId?: string) =>
  sources.find((r) => r.id === preferredId) ?? sources[0];

/* -------------------------------------------------------------- ats check */

export const START_FAILED = "We couldn't start it. Check your connection and try again.";

/** What a resume-making step promises about skills, said once (toreview §131). */
export const NEVER_ADDS_SKILLS =
  'We only add skills you tick. Interviewers may ask about anything on it.';

/** The ATS score's own disclaimer, one wording everywhere it shows (V2 §7.8, toreview §131). */
export const ATS_DISCLAIMER =
  'The ATS score is NextKin’s own measure, not a result from any employer’s hiring software.';
