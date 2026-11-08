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

export type SignInDraft = {
  email: string;
  password: string;
};

export const blankSignUp = (): SignUpDraft => ({ fullName: '', email: '', password: '' });

export const blankSignIn = (): SignInDraft => ({ email: '', password: '' });

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

/**
 * The same presence check over two fields. Deliberately a second function rather than one
 * driven by a field list: the module's whole argument is that three rules are the product's
 * rather than a schema library's, and five would be no different.
 */
export function validateSignIn(draft: SignInDraft): Validation {
  const errors: Record<string, string> = {};
  if (blank(draft.email)) errors.email = 'Add an email address.';
  // Not sign-up's "Choose a password." — nothing is being chosen here.
  if (blank(draft.password)) errors.password = 'Enter your password.';
  return verdict(errors);
}

// ---------------------------------------------------------------------------------------------
// Against the backend (ImBackendImplementationPlan P5-08). The server's own messages are written
// for any client; these say it in the sign-in screens' voice, and never reveal whether an account
// exists (a wrong password and an unknown email read the same).

export const SIGN_IN_FAILED = 'That email and password don’t match.';
export const CONFIRM_FIRST = 'Confirm your email first: we sent you a code.';
export const TOO_MANY_TRIES = 'Too many tries. Wait a minute, then try again.';
export const CODE_WRONG = 'That code is wrong or has expired.';
export const GOOGLE_NOT_CONNECTED = 'Google sign-in isn’t connected in this build yet.';

type ServerError = { code?: unknown; message?: unknown; details?: unknown };

const asServerError = (error: unknown): ServerError =>
  typeof error === 'object' && error !== null ? (error as ServerError) : {};

const detail = (error: ServerError, key: string): unknown =>
  typeof error.details === 'object' && error.details !== null
    ? (error.details as Record<string, unknown>)[key]
    : undefined;

// A dropped connection says so; so does Clerk (§173), whose sentence names what it wants instead.
const fallback = (error: ServerError, otherwise: string): string =>
  (error.code === 'NETWORK' || error.code === 'CLERK') &&
  typeof error.message === 'string' &&
  error.message
    ? error.message
    : otherwise;

export function signInErrorMessage(error: unknown): string {
  const e = asServerError(error);
  if (e.code === 'UNAUTHENTICATED') return SIGN_IN_FAILED;
  if (e.code === 'FORBIDDEN' && detail(e, 'notConfirmed')) return CONFIRM_FIRST;
  if (e.code === 'RATE_LIMITED') return TOO_MANY_TRIES;
  return fallback(e, 'We couldn’t sign you in. Try again.');
}

export function signUpErrorMessage(error: unknown): string {
  const e = asServerError(error);
  if (e.code === 'VALIDATION_FAILED' && detail(e, 'password'))
    return 'Choose a longer or less common password.';
  if (e.code === 'VALIDATION_FAILED' && detail(e, 'email')) return 'Check the email address.';
  if (e.code === 'RATE_LIMITED') return TOO_MANY_TRIES;
  return fallback(e, 'We couldn’t create your account. Try again.');
}

export function confirmErrorMessage(error: unknown): string {
  const e = asServerError(error);
  if (e.code === 'VALIDATION_FAILED') return CODE_WRONG;
  if (e.code === 'RATE_LIMITED') return TOO_MANY_TRIES;
  return fallback(e, 'We couldn’t check that code. Try again.');
}

/** The code field takes six digits and nothing else. */
export const CODE_LENGTH = 6;
const CODE_PATTERN = /^\d{6}$/; // CODE_LENGTH digits
export const codeComplete = (code: string): boolean => CODE_PATTERN.test(code.trim());
