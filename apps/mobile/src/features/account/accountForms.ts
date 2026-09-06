/**
 * NextKin V2 §7.1 (email, password, sessions) and §8.4 — the rules behind the account form, with
 * no React in them.
 *
 * The screen holds its two drafts in `useState`; everything that *decides* something about them —
 * whether an address is worth sending a verification to, whether three password boxes agree —
 * lives here, so it is unit tested without rendering a page. The same split as
 * `profile/profileForms.ts` and `profile/identityForm.ts`. No react-hook-form and no zod: five
 * fields, and the rules are the product's rather than a schema library's.
 *
 * §8.4 draws the line this module stops at: only the identity provider ever holds a password, so
 * nothing here checks whether the current one is right. That answer comes back from the server as
 * a rejection, and the form shows it. What is checked here is only what can be checked on the
 * device — length, agreement, and that the new password is not the old one again.
 */

export type Validation = { ok: true } | { ok: false; errors: Record<string, string> };

/** The floor the sign-in service enforces; said in the field's helper before it is enforced. */
export const PASSWORD_MIN = 8;

const verdict = (errors: Record<string, string>): Validation =>
  Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };

/**
 * One @, something either side of it, and a dot in the domain. Deliberately loose: the real test
 * of an address is whether the verification email arrives, and a stricter pattern only ever
 * refuses addresses that work.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const looksLikeEmail = (value: string): boolean => EMAIL.test(value.trim());

/** Addresses are compared case-insensitively, because that is how they are delivered. */
export const sameAddress = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The new address, against the one on the account. Re-sending yourself to where you already are
 * is refused rather than accepted quietly: it would look like it worked and change nothing.
 */
export function validateNewEmail(next: string, current: string): Validation {
  const errors: Record<string, string> = {};
  if (next.trim().length === 0) errors.email = 'Add the address you want to use.';
  else if (!looksLikeEmail(next)) errors.email = "That doesn't look like an email address.";
  else if (sameAddress(next, current)) errors.email = 'That is already your address.';
  return verdict(errors);
}

export type PasswordDraft = {
  current: string;
  next: string;
  confirm: string;
};

export const emptyPasswordDraft = (): PasswordDraft => ({ current: '', next: '', confirm: '' });

/**
 * Never trimmed: a leading or trailing space is a legal part of a password, and quietly removing
 * one here would send the identity provider something the reader did not type.
 */
export function validatePasswordChange(draft: PasswordDraft): Validation {
  const errors: Record<string, string> = {};

  if (draft.current.length === 0) errors.current = 'Enter the password you use now.';

  if (draft.next.length === 0) errors.next = 'Choose a new password.';
  else if (draft.next.length < PASSWORD_MIN) errors.next = `Use at least ${PASSWORD_MIN} characters.`;
  else if (draft.next === draft.current) errors.next = 'That is the password you already use.';

  if (draft.confirm.length === 0) errors.confirm = 'Type the new password again.';
  else if (draft.confirm !== draft.next) errors.confirm = "The two new passwords don't match.";

  return verdict(errors);
}

/* -------------------------------------------------------------------------- copy */

/** Said before the send, so nobody presses it expecting the address to change on the spot. */
export const EMAIL_HELPER =
  'We send a verification link there. It becomes your sign-in address once you open the link.';

export const emailSentNote = (address: string): string =>
  `Verification sent to ${address}. Open the link in that email to finish the change.`;

export const EMAIL_SEND_FAILED =
  "We couldn't send that verification email. Check your connection and try again.";

/** §8.4, in the reader's words: the app proxies the change, it never verifies the password. */
export const PASSWORD_NOTE =
  'Your password is held by the sign-in service, not by NextKin. We pass the change on and show you what it says.';

export const PASSWORD_CHANGED = 'Password changed. Use the new one the next time you sign in.';

export const PASSWORD_CHANGE_FAILED =
  "We couldn't change your password. Check that the current one is right and try again.";

export const SIGN_OUT_EVERYWHERE_FAILED =
  "We couldn't sign your devices out. Check your connection and try again.";
