/**
 * NextKin V2 §7.1 — the rules behind the sign-up form, with no React in them.
 *
 * The same split as `account/accountForms.ts` and `profile/profileForms.ts`: the screen holds its
 * draft in `useState` and everything that *decides* something about it lives here, so it is unit
 * tested without rendering a page. No react-hook-form and no zod — three fields, and the rules
 * are the product's rather than a schema library's.
 *
 * **This checks presence and nothing else, on purpose.** The milestone has no backend and no
 * identity provider, so there is no account to create and nothing to be right or wrong about:
 * any name, any address and any password sign you into the pre-seeded mock account. An email
 * *shape* rule is deliberately not applied — it would refuse the throwaway values the flow is
 * meant to be driven with while proving nothing, since the real test of an address is whether
 * the verification mail arrives. `looksLikeEmail` in `accountForms.ts` is waiting for §7.1 to
 * gain a server. See toreview.md.
 */

export type Validation = { ok: true } | { ok: false; errors: Record<string, string> };

export type SignUpDraft = {
  fullName: string;
  email: string;
  password: string;
};

export const blankSignUp = (): SignUpDraft => ({ fullName: '', email: '', password: '' });

const blank = (value: string): boolean => value.trim().length === 0;

const verdict = (errors: Record<string, string>): Validation =>
  Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };

/** Shown under the primary button when a refused submit left something to fix. */
export const FIX_FIRST = 'Fill in every field to continue.';

export function validateSignUp(draft: SignUpDraft): Validation {
  const errors: Record<string, string> = {};
  if (blank(draft.fullName)) errors.fullName = 'Add your name.';
  if (blank(draft.email)) errors.email = 'Add an email address.';
  if (blank(draft.password)) errors.password = 'Choose a password.';
  return verdict(errors);
}

export const signUpComplete = (draft: SignUpDraft): boolean => validateSignUp(draft).ok;
