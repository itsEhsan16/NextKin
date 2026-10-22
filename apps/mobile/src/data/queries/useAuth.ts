import { useCallback, useRef, useState } from 'react';

import { auth, USES_BACKEND } from '../dataSource';

/**
 * Sign-in and sign-up against the backend (ImBackendImplementationPlan P5-08), as hooks so screens
 * keep importing only from `@/data/queries` (CLAUDE.md rule 3).
 *
 * On the mock (`EXPO_PUBLIC_DATA_SOURCE` unset) every call resolves at once and sign-up needs no
 * code, which is exactly what the screens did before: any details sign you into the seeded account.
 *
 * Not React Query mutations: nothing here is cached data, and the signed-out screens render above
 * any query client. `useAction` gives the same `mutate(input, { onSuccess, onError })` and
 * `isPending` surface, and drops a second call while one is in flight.
 */

export const backendAuth = USES_BACKEND;

export type Credentials = { email: string; password: string };

type Callbacks<R> = { onSuccess?: (result: R) => void; onError?: (error: unknown) => void };

function useAction<I, R>(run: (input: I) => Promise<R>) {
  const [isPending, setPending] = useState(false);
  const inFlight = useRef(false);
  const mutate = useCallback(
    (input: I, callbacks: Callbacks<R> = {}) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(true);
      run(input).then(
        (result) => {
          inFlight.current = false;
          setPending(false);
          callbacks.onSuccess?.(result);
        },
        (error: unknown) => {
          inFlight.current = false;
          setPending(false);
          callbacks.onError?.(error);
        },
      );
    },
    [run],
  );
  return { mutate, isPending };
}

const signInWithPassword = async ({ email, password }: Credentials) => {
  if (USES_BACKEND) await auth.login(email.trim(), password);
};

export const usePasswordSignIn = () => useAction(signInWithPassword);

/** Resolves `needsCode: true` when the backend has emailed a confirmation code. */
const startSignUp = async ({ name, email, password }: Credentials & { name: string }) => {
  if (!USES_BACKEND) return { needsCode: false };
  await auth.signUp(email.trim(), password, name.trim() || undefined);
  return { needsCode: true };
};

export const useStartSignUp = () => useAction(startSignUp);

/** Confirms the emailed code, then signs in with the password the reader just chose. */
const confirmSignUp = async ({ email, password, code }: Credentials & { code: string }) => {
  await auth.confirm(email.trim(), code.trim());
  await auth.login(email.trim(), password);
};

export const useConfirmSignUp = () => useAction(confirmSignUp);

const resendCode = (email: string) => auth.resendCode(email.trim());

export const useResendSignUpCode = () => useAction(resendCode);
