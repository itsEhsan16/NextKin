import { CITY_SUGGESTIONS, type Profile, type ProfilePatch, type User } from '@/data/models';

/**
 * NextKin V2 spec §7.3 (personal info) — the rules behind the "Edit profile" form, with no React
 * in them.
 *
 * The screen holds a draft in `useState`; everything that *decides* something about that draft —
 * whether it is valid, whether it differs from what loaded, what each of the two aggregates is
 * sent — lives here, so it is unit tested without rendering a page. The same split as
 * `resumes/sectionEdits.ts` and `create/jdSkillEdits.ts`. No react-hook-form and no zod: five
 * fields and the rules are the product's, not a schema library's.
 *
 * The interesting part is that one form edits two aggregates. `nameChanged` and `detailsChanged`
 * answer that separately, so a save writes only the half the reader actually touched.
 */

/** The headline is the one line under a name, not a summary; the cap is what keeps it one line. */
export const HEADLINE_MAX = 90;

/** Longer than any career, so a slipped digit reads as the typo it is rather than as a number. */
export const MAX_YEARS = 60;

/** How many cities the location field offers at once — a row of chips, not a list. */
export const CITY_SUGGESTION_LIMIT = 4;

export type IdentityDraft = {
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  /** Held as text because that is what the field gives back; parsed on the way out. */
  yearsExperience: string;
};

export type Validation = { ok: true } | { ok: false; errors: Record<string, string> };

/** What the form starts at: the user aggregate's name, the profile aggregate's three fields. */
export function identityDraft(user: User, profile: Profile): IdentityDraft {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    headline: profile.headline ?? '',
    location: profile.location ?? '',
    yearsExperience: profile.yearsExperience != null ? String(profile.yearsExperience) : '',
  };
}

/**
 * The number behind the years field, or undefined when it is blank — an unfilled field is the
 * form's resting state, not an error, and an unfilled one clears the value rather than storing 0.
 */
export function yearsValue(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

const WHOLE_NUMBER = /^\d+$/;

/**
 * What has to be true before Save goes live. A name is required — it is what every screen in the
 * app calls this person — and everything else is optional, so only a *wrong* value is refused.
 */
export function validateIdentity(draft: IdentityDraft): Validation {
  const errors: Record<string, string> = {};

  if (draft.firstName.trim().length === 0) errors.firstName = 'Enter your first name.';
  if (draft.lastName.trim().length === 0) errors.lastName = 'Enter your last name.';

  const headline = draft.headline.trim();
  if (headline.length > HEADLINE_MAX) {
    errors.headline = `That is ${headline.length} characters. Keep it under ${HEADLINE_MAX}.`;
  }

  const years = draft.yearsExperience.trim();
  if (years.length > 0) {
    if (!WHOLE_NUMBER.test(years)) errors.yearsExperience = 'Use a whole number of years.';
    else if (Number(years) > MAX_YEARS) {
      errors.yearsExperience = `Enter a number between 0 and ${MAX_YEARS}.`;
    }
  }

  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };
}

/** Spaces around a value are not an edit, so every comparison below is made on the trim. */
export function nameChanged(draft: IdentityDraft, base: IdentityDraft): boolean {
  return (
    draft.firstName.trim() !== base.firstName.trim() ||
    draft.lastName.trim() !== base.lastName.trim()
  );
}

/** The profile half: headline, location and years. "08" and "8" are the same eight years. */
export function detailsChanged(draft: IdentityDraft, base: IdentityDraft): boolean {
  return (
    draft.headline.trim() !== base.headline.trim() ||
    draft.location.trim() !== base.location.trim() ||
    yearsValue(draft.yearsExperience) !== yearsValue(base.yearsExperience)
  );
}

export const identityDirty = (draft: IdentityDraft, base: IdentityDraft): boolean =>
  nameChanged(draft, base) || detailsChanged(draft, base);

export function namePatch(draft: IdentityDraft): { firstName: string; lastName: string } {
  return { firstName: draft.firstName.trim(), lastName: draft.lastName.trim() };
}

/**
 * The profile write. A cleared field sends `undefined` rather than an empty string: the repo
 * spreads the patch over the profile, so undefined is how a headline is actually removed.
 */
export function profilePatch(draft: IdentityDraft): ProfilePatch {
  const headline = draft.headline.trim();
  const location = draft.location.trim();
  return {
    headline: headline.length > 0 ? headline : undefined,
    location: location.length > 0 ? location : undefined,
    yearsExperience: yearsValue(draft.yearsExperience),
  };
}

/**
 * Cities offered under the location field once the reader starts typing. Nothing is offered for
 * an empty field — a wall of chips under an untouched input reads as a required choice — and
 * nothing is offered once the field already says one of them.
 */
export function citySuggestions(query: string, limit = CITY_SUGGESTION_LIMIT): string[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];
  return CITY_SUGGESTIONS.filter((city) => {
    const name = city.toLowerCase();
    return name !== needle && name.includes(needle);
  }).slice(0, limit);
}
