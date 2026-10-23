/**
 * The rules behind web's sign-in form (V2 §7.1), with no React in them. They say what mobile's
 * `features/auth/authForms.ts` says, in the same words, so the two sign-in screens read as one
 * product: presence only, and a refusal that never reveals whether an account exists.
 */

export type SignInDraft = { email: string; password: string };

export type SignInErrors = Partial<Record<keyof SignInDraft, string>>;

export function validateSignIn(draft: SignInDraft): SignInErrors {
  const errors: SignInErrors = {};
  if (draft.email.trim().length === 0) errors.email = 'Add an email address.';
  if (draft.password.length === 0) errors.password = 'Enter your password.';
  return errors;
}

export const SIGN_IN_FAILED = 'That email and password don’t match.';
export const CONFIRM_FIRST = 'Confirm your email first: we sent you a code.';
export const TOO_MANY_TRIES = 'Too many tries. Wait a minute, then try again.';

type ServerError = { code?: unknown; message?: unknown; details?: unknown };

/** The server's error, said in the sign-in screen's voice. */
export function signInErrorMessage(error: unknown): string {
  const e: ServerError = typeof error === 'object' && error !== null ? error : {};
  const details =
    typeof e.details === 'object' && e.details !== null
      ? (e.details as Record<string, unknown>)
      : {};
  if (e.code === 'UNAUTHENTICATED') return SIGN_IN_FAILED;
  if (e.code === 'FORBIDDEN' && details.notConfirmed) return CONFIRM_FIRST;
  if (e.code === 'RATE_LIMITED') return TOO_MANY_TRIES;
  if (e.code === 'NETWORK' && typeof e.message === 'string') return e.message;
  return 'We couldn’t sign you in. Try again.';
}
