import { track } from '@nextkin/shared/queries';

import { auth, USES_BACKEND, USES_CLERK } from '../dataSource';
import { useAction } from './useAction';
import {
  useClerkConfirmCode,
  useClerkGoogleSignIn,
  useClerkPasswordSignIn,
  useClerkResendCode,
  useClerkStartSignUp,
} from './useClerkAuth';

/**
 * Sign-in and sign-up against the backend (ImBackendImplementationPlan P5-08), as hooks so screens
 * keep importing only from `@/data/queries` (CLAUDE.md rule 3).
 *
 * On the mock (`EXPO_PUBLIC_DATA_SOURCE` unset) every call resolves at once and sign-up needs no
 * code, which is exactly what the screens did before: any details sign you into the seeded account.
 * On the backend the server's own identity provider checks them, or Clerk does when its key is set
 * (`useClerkAuth.ts`, toreview §173); the pair is chosen once, at load, so the hooks a screen calls
 * never change between renders.
 *
 * Not React Query mutations: nothing here is cached data, and the signed-out screens render above
 * any query client. `useAction` gives the same `mutate(input, { onSuccess, onError })` and
 * `isPending` surface, and drops a second call while one is in flight.
 */

export const backendAuth = USES_BACKEND;

/** Whether "Continue with Google" works in this build: on the mock, and on the backend with Clerk. */
export const googleSignInAvailable = !USES_BACKEND || USES_CLERK;

export type Credentials = { email: string; password: string };

/** `needsCode`: a code was emailed (a new account, or Clerk checking a new device). */
const signInWithPassword = async ({ email, password }: Credentials) => {
  if (USES_BACKEND) await auth.login(email.trim(), password);
  return { needsCode: false };
};

const usePasswordSignInLocal = () => useAction(signInWithPassword);

/** Resolves `needsCode: true` when the backend has emailed a confirmation code. */
const startSignUp = async ({ name, email, password }: Credentials & { name: string }) => {
  if (!USES_BACKEND) return { needsCode: false };
  await auth.signUp(email.trim(), password, name.trim() || undefined);
  return { needsCode: true };
};

const useStartSignUpLocal = () => useAction(startSignUp);

/** Confirms the emailed code, then signs in with the password the reader just chose. */
const confirmSignUp = async ({ email, password, code }: Credentials & { code: string }) => {
  await auth.confirm(email.trim(), code.trim());
  await auth.login(email.trim(), password);
  track('sign_up_completed');
  return { newAccount: true };
};

const useConfirmSignUpLocal = () => useAction(confirmSignUp);

const resendCode = (email: string) => auth.resendCode(email.trim());

const useResendSignUpCodeLocal = () => useAction(resendCode);

// Only Clerk runs Google here: the mock's button signs straight in, and the server's own provider
// has no Google client on the demo.
const googleUnavailable = async (_input: void) => {
  throw { code: 'CLERK', message: 'Google sign-in isn’t connected in this build yet.' };
};

const useGoogleSignInLocal = () => useAction(googleUnavailable);

export const usePasswordSignIn = USES_CLERK ? useClerkPasswordSignIn : usePasswordSignInLocal;
export const useStartSignUp = USES_CLERK ? useClerkStartSignUp : useStartSignUpLocal;
export const useConfirmSignUp = USES_CLERK ? useClerkConfirmCode : useConfirmSignUpLocal;
export const useResendSignUpCode = USES_CLERK ? useClerkResendCode : useResendSignUpCodeLocal;
export const useGoogleSignIn = USES_CLERK
  ? useClerkGoogleSignIn
  : (useGoogleSignInLocal as typeof useClerkGoogleSignIn);
