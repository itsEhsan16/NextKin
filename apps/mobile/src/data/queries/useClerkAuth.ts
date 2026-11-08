import { useSignIn, useSignUp, useSSO } from '@clerk/expo';

import { track } from '@nextkin/shared/queries';

import { clerk, clerkToken } from '../clerkSession';
import { auth } from '../dataSource';
import { useAction } from './useAction';

/**
 * The auth hooks on Clerk (toreview §173), same inputs and results as the password ones in
 * `useAuth.ts`, so the designed screens don't change. Clerk checks the password, sends the codes
 * and runs Google; then `openSession` exchanges Clerk's token for the server's session.
 *
 * Errors come back shaped like the server's (`code`, `details`) so `authForms`' messages apply;
 * anything they don't name carries Clerk's own sentence as code `CLERK`.
 */

type AuthFailure = { code: string; message: string; details?: Record<string, boolean> };

type ClerkErrorLike = {
  code?: string;
  message?: string;
  longMessage?: string;
  errors?: {
    code?: string;
    message?: string;
    longMessage?: string;
    meta?: { paramName?: string };
  }[];
};

const fail = (message: string): AuthFailure => ({ code: 'CLERK', message });

export function fromClerk(error: unknown): AuthFailure {
  const e = (error ?? {}) as ClerkErrorLike;
  const first = e.errors?.[0];
  const code = first?.code ?? e.code ?? '';
  const message = first?.longMessage ?? first?.message ?? e.longMessage ?? e.message ?? '';
  const param = first?.meta?.paramName ?? '';
  if (
    code === 'form_password_incorrect' ||
    code === 'form_identifier_not_found' ||
    code === 'strategy_for_user_invalid'
  )
    return { code: 'UNAUTHENTICATED', message };
  if (code === 'too_many_requests' || code === 'user_locked')
    return { code: 'RATE_LIMITED', message };
  if (code.startsWith('form_password'))
    return { code: 'VALIDATION_FAILED', message, details: { password: true } };
  if (code === 'form_code_incorrect' || code.startsWith('verification_'))
    return { code: 'VALIDATION_FAILED', message };
  if (param === 'email_address')
    return { code: 'VALIDATION_FAILED', message, details: { email: true } };
  if (code === 'form_identifier_exists')
    return fail('That email already has an account. Sign in instead.');
  if (code === 'network_error' || !code)
    return { code: 'NETWORK', message: message || 'Check your connection and try again.' };
  return fail(message || 'Something went wrong. Try again.');
}

/** Clerk has a session: open ours for it. If that fails, end Clerk's too, so the two agree. */
async function openSession(): Promise<void> {
  try {
    const token = await clerkToken();
    if (!token) throw fail('Sign-in didn’t finish. Try again.');
    await auth.clerkExchange(token);
  } catch (error) {
    await clerk()
      .signOut()
      .catch(() => {});
    throw error;
  }
}

/** Which attempt the emailed code finishes: a new account, or a sign-in on a new device. */
let pendingCode: 'sign-up' | 'sign-in' = 'sign-up';

export function useClerkPasswordSignIn() {
  const { signIn } = useSignIn();
  return useAction(async ({ email, password }: { email: string; password: string }) => {
    // A stale attempt (an earlier try, a back-out from the code screen) would answer for this one.
    await signIn.reset();
    const { error } = await signIn.password({ emailAddress: email.trim(), password });
    if (error) throw fromClerk(error);
    if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
      // A new device, or a second step: Clerk asks for a code it emails.
      const byEmail = signIn.supportedSecondFactors?.some((f) => f.strategy === 'email_code');
      if (!byEmail)
        throw fail(
          'This account needs a sign-in step the app can’t do yet. Sign in on the website.',
        );
      const sent = await signIn.mfa.sendEmailCode();
      if (sent.error) throw fromClerk(sent.error);
      pendingCode = 'sign-in';
      return { needsCode: true };
    }
    if (signIn.status !== 'complete') throw fail('Sign-in didn’t finish. Try again.');
    const done = await signIn.finalize();
    if (done.error) throw fromClerk(done.error);
    await openSession();
    return { needsCode: false };
  });
}

export function useClerkStartSignUp() {
  const { signUp } = useSignUp();
  return useAction(
    async ({ name, email, password }: { name: string; email: string; password: string }) => {
      await signUp.reset();
      const [firstName, ...rest] = name.trim().split(/\s+/);
      const { error } = await signUp.password({
        emailAddress: email.trim(),
        password,
        ...(firstName ? { firstName } : {}),
        ...(rest.length ? { lastName: rest.join(' ') } : {}),
      });
      if (error) throw fromClerk(error);
      if (signUp.status === 'complete') {
        const done = await signUp.finalize();
        if (done.error) throw fromClerk(done.error);
        await openSession();
        track('sign_up_completed');
        return { needsCode: false };
      }
      const sent = await signUp.verifications.sendEmailCode();
      if (sent.error) throw fromClerk(sent.error);
      pendingCode = 'sign-up';
      return { needsCode: true };
    },
  );
}

export function useClerkConfirmCode() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  return useAction(async ({ code }: { email: string; password: string; code: string }) => {
    if (pendingCode === 'sign-in') {
      const { error } = await signIn.mfa.verifyEmailCode({ code: code.trim() });
      if (error) throw fromClerk(error);
      if (signIn.status !== 'complete') throw fail('Sign-in didn’t finish. Try again.');
      const done = await signIn.finalize();
      if (done.error) throw fromClerk(done.error);
      await openSession();
      return { newAccount: false };
    }
    const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (error) throw fromClerk(error);
    if (signUp.status !== 'complete')
      throw fail('We need a little more to finish your account. Try again.');
    const done = await signUp.finalize();
    if (done.error) throw fromClerk(done.error);
    await openSession();
    track('sign_up_completed');
    return { newAccount: true };
  });
}

export function useClerkResendCode() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  return useAction(async (_email: string) => {
    const { error } =
      pendingCode === 'sign-in'
        ? await signIn.mfa.sendEmailCode()
        : await signUp.verifications.sendEmailCode();
    if (error) throw fromClerk(error);
  });
}

export function useClerkGoogleSignIn() {
  const { startSSOFlow } = useSSO();
  return useAction(async (_input: void) => {
    let result: Awaited<ReturnType<typeof startSSOFlow>>;
    try {
      result = await startSSOFlow({ strategy: 'oauth_google' });
    } catch (error) {
      throw fromClerk(error);
    }
    // Closed the browser, or Clerk wants more than Google gave: nothing happened.
    if (!result.createdSessionId || !result.setActive)
      return { signedIn: false, newAccount: false };
    await result.setActive({ session: result.createdSessionId });
    await openSession();
    const newAccount = result.signUp?.createdSessionId === result.createdSessionId;
    if (newAccount) track('sign_up_completed');
    return { signedIn: true, newAccount };
  });
}
