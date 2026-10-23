import type { User, ZeroSeed, ZeroYears } from '@/data/models';
import { ZERO_YEARS_VALUE } from '@/data/models';

/**
 * ZERO 01's rules (V2 §7.9, toreview §72): what "About you" holds, when it is enough to write a
 * draft, and the seed the run is started with. Pure, so the screen only renders and the rules are
 * tested without mounting it.
 */

/** What the form holds. `years` is unpicked until the reader taps a band. */
export type ZeroAbout = { fullName: string; years: ZeroYears | null; role: string };

export const emptyZeroAbout: ZeroAbout = { fullName: '', years: null, role: '' };

/** The name is a resume header line; the role is one line on it. */
export const NAME_MAX = 80;
export const ROLE_MAX = 80;

/** The primary's label (613:291), shared with the inert copy the loading state pins. */
export const ZERO_CTA = 'Write my draft';

export const ZERO_START_FAILED =
  "We couldn't start your draft. Check your connection and try again.";

export type ZeroAboutErrors = Partial<Record<keyof ZeroAbout, string>>;

/** "Tell us three things": each of the three is needed, and the two text fields have a length. */
export function validateZeroAbout(about: ZeroAbout): ZeroAboutErrors {
  const errors: ZeroAboutErrors = {};
  const name = about.fullName.trim();
  if (name.length === 0) errors.fullName = 'Add the name you want printed on the resume.';
  else if (name.length > NAME_MAX) errors.fullName = `Keep the name under ${NAME_MAX} characters.`;

  if (about.years == null) errors.years = 'Pick how long you have worked. None is a fine answer.';

  const role = about.role.trim();
  if (role.length === 0) errors.role = 'Add the role you want, like Product Designer.';
  else if (role.length > ROLE_MAX) errors.role = `Keep the role under ${ROLE_MAX} characters.`;
  return errors;
}

export const isZeroAboutReady = (about: ZeroAbout): boolean =>
  Object.keys(validateZeroAbout(about)).length === 0;

/** The run's seed; call it on a form that passed `validateZeroAbout`. */
export function zeroSeedFrom(about: ZeroAbout): ZeroSeed {
  const band = about.years ?? 'none';
  return {
    fullName: about.fullName.trim(),
    yearsBand: band,
    yearsExperience: ZERO_YEARS_VALUE[band],
    targetTitle: about.role.trim(),
  };
}

/** The prefill for the name field — still editable, because the resume's name is the user's call. */
export const fullNameOf = (user: Pick<User, 'firstName' | 'lastName'>): string =>
  [user.firstName, user.lastName]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ');
