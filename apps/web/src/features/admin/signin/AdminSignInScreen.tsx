'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import type { AdminSignInResult, AuthenticatorSetup } from '@nextkin/shared/models';
import {
  useAdminConfirmEnrollment,
  useAdminSetNewPassword,
  useAdminSignIn,
} from '@nextkin/shared/queries';

import { AdminIcon } from '@/ui/animated/AdminIcon';
import { LogoMarkIllustration } from '@/ui/illustrations';

import { TextField } from '../ui/AdminForm';
import { BackupCodeStep, CodeStep } from './CodeSteps';
import { EnrollStep, NewPasswordStep, SaveCodesStep } from './FirstSignInSteps';
import { Backdrop, ErrorLine, Heading, SubmitButton } from './SignInParts';

type Step = 'password' | 'code' | 'backup' | 'enroll' | 'codes' | 'newPassword';

const ADMIN_HOME = '/admin' as Route;

const messageOf = (failure: unknown) => (failure instanceof Error ? failure.message : '');
/** A first-sign-in step outlived its ten minutes (or its five tries): start again. */
const expired = (failure: unknown) => /expired/i.test(messageOf(failure));

/**
 * Staff sign-in (Figma 410:1605, "Two-step verification"). Staff accounts are the server's own,
 * never the users' identity provider (toreview §171.13). The board draws the code step only; the
 * password, backup-code and first-sign-in steps are built from the same card, type and kit and are
 * design-gated until boards arrive (§171).
 *
 * A correct password answers with what comes next: the authenticator's code, or, for a new or
 * reset account, setting up the authenticator, saving the backup codes and choosing a password.
 * Every attempt is logged.
 */
export function AdminSignInScreen() {
  const router = useRouter();
  const signIn = useAdminSignIn();
  const enroll = useAdminConfirmEnrollment();
  const setNewPassword = useAdminSetNewPassword();
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Bumped after a refused code, so the boxes take focus back.
  const [attempt, setAttempt] = useState(0);
  const [setup, setSetup] = useState<AuthenticatorSetup | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [afterCodes, setAfterCodes] = useState<'newPassword' | 'home'>('home');

  const switchTo = (next: Step) => {
    setError(null);
    if (next === 'password') {
      setPassword('');
      setSetup(null);
      setChallenge(null);
    }
    setStep(next);
  };

  /** Follows the server's answer to the next step. */
  const advance = (result: AdminSignInResult) => {
    setError(null);
    if (result.status === 'mfa_required') return setStep('code');
    if (result.status === 'enroll_totp') {
      setSetup(result);
      return setStep('enroll');
    }
    if (result.status === 'change_password') {
      setChallenge(result.challenge);
      if (!result.backupCodes) return setStep('newPassword');
      setCodes(result.backupCodes);
      setAfterCodes('newPassword');
      return setStep('codes');
    }
    if (result.backupCodes) {
      setCodes(result.backupCodes);
      setAfterCodes('home');
      return setStep('codes');
    }
    router.replace(ADMIN_HOME);
  };

  const restart = () => {
    switchTo('password');
    setError('That step took too long. Sign in again.');
  };

  const submit = async (totp?: string) => {
    setError(null);
    try {
      advance(
        await signIn.mutateAsync({ email: email.trim(), password, ...(totp ? { totp } : {}) }),
      );
    } catch (failure) {
      const message = messageOf(failure);
      if (step === 'password')
        setError(message || 'That email and password don’t match a staff account.');
      else if (step === 'backup') setError('That backup code didn’t work. Each code works once.');
      else {
        setError('That code didn’t work. Check your app and try again.');
        setAttempt((count) => count + 1);
      }
    }
  };

  const onPassword = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your staff email and password.');
      return;
    }
    void submit();
  };

  const busy = signIn.isPending || enroll.isPending || setNewPassword.isPending;

  return (
    <main
      data-admin-signin=""
      className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-neutral-50 px-4"
    >
      <Backdrop />

      <div className="relative flex w-full flex-1 flex-col items-center pb-10 pt-[min(240px,18vh)]">
        <span className="flex items-center gap-2.5">
          <LogoMarkIllustration className="h-10 w-[39px]" />
          <span className="text-admin-display text-text-primary">NextKin</span>
        </span>

        <section
          aria-labelledby="signin-title"
          className="mt-12 flex w-full max-w-[400px] animate-rise flex-col items-center gap-6 rounded-lg border border-neutral-200 bg-surface-card p-8 shadow-modal"
        >
          {step === 'password' && (
            <form
              onSubmit={onPassword}
              noValidate
              className="flex w-full flex-col items-center gap-6"
            >
              <Heading
                icon="Lock01"
                title="Staff sign-in"
                text="Sign in with your staff account. You’ll confirm it with your authenticator next."
              />
              <div className="flex w-full flex-col gap-4">
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoFocus
                />
                <TextField
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error && <ErrorLine>{error}</ErrorLine>}
              <SubmitButton busy={busy} label="Continue" />
            </form>
          )}
          {step === 'code' && (
            <CodeStep
              email={email.trim()}
              busy={busy}
              error={error}
              attempt={attempt}
              onSubmit={(code) => void submit(code)}
              onClearError={() => setError(null)}
              onBackup={() => switchTo('backup')}
              onBack={() => switchTo('password')}
            />
          )}
          {step === 'backup' && (
            <BackupCodeStep
              email={email.trim()}
              busy={busy}
              error={error}
              onSubmit={(code) => void submit(code)}
              onInvalid={setError}
              onAuthenticator={() => switchTo('code')}
              onBack={() => switchTo('password')}
            />
          )}
          {step === 'enroll' && setup && (
            <EnrollStep
              email={email.trim()}
              secret={setup.secret}
              otpauthUrl={setup.otpauthUrl}
              busy={busy}
              error={error}
              attempt={attempt}
              onBack={() => switchTo('password')}
              onSubmit={(code) =>
                void enroll
                  .mutateAsync({ challenge: setup.challenge, code })
                  .then(advance)
                  .catch((failure: unknown) => {
                    if (expired(failure)) return restart();
                    setError('That code didn’t work. Check your app and try again.');
                    setAttempt((count) => count + 1);
                  })
              }
            />
          )}
          {step === 'codes' && codes && (
            <SaveCodesStep
              codes={codes}
              onContinue={() => {
                setCodes(null);
                if (afterCodes === 'newPassword') setStep('newPassword');
                else router.replace(ADMIN_HOME);
              }}
            />
          )}
          {step === 'newPassword' && challenge && (
            <NewPasswordStep
              busy={busy}
              error={error}
              onSubmit={(next) =>
                void setNewPassword
                  .mutateAsync({ challenge, password: next })
                  .then(advance)
                  .catch((failure: unknown) => {
                    if (expired(failure)) return restart();
                    setError(messageOf(failure) || 'That password wasn’t accepted. Try another.');
                  })
              }
            />
          )}
        </section>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-body-s">
          <span className="text-text-secondary">Lost your authenticator?</span>
          <span className="font-semibold text-brand-700">
            Ask a Super Admin to reset your sign-in
          </span>
        </p>

        <span className="flex-1" />
        <p className="mt-10 flex items-center gap-2 text-body-s text-text-tertiary">
          <AdminIcon name="Lock01" size="sm" />
          Staff only · all access is logged
        </p>
      </div>
    </main>
  );
}
