'use client';

import { useState, type FormEvent } from 'react';

import { STAFF_PASSWORD_MIN } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';

import { adminButton } from '../ui/adminButton';
import { TextField } from '../ui/AdminForm';
import { AuthenticatorQr, BackupCodeList } from '../ui/AuthenticatorSetup';
import { CodeInput, isComplete } from './CodeInput';
import { ErrorLine, Heading, LinkButton, SubmitButton } from './SignInParts';

/**
 * A new staff account's first sign-in (toreview §171.13), and a reset account's: after the
 * temporary password, set up the authenticator, save the backup codes, then choose a password.
 * Built from the sign-in card's own kit; no board draws these steps yet (design-gated, §171).
 */

export function EnrollStep({
  email,
  secret,
  otpauthUrl,
  busy,
  error,
  attempt,
  onSubmit,
  onBack,
}: {
  email: string;
  secret: string;
  otpauthUrl: string;
  busy: boolean;
  error: string | null;
  attempt: number;
  onSubmit: (code: string) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState('      ');
  const [local, setLocal] = useState<string | null>(null);
  const [seenAttempt, setSeenAttempt] = useState(attempt);
  // A refused code empties the boxes.
  if (attempt !== seenAttempt) {
    setSeenAttempt(attempt);
    setCode('      ');
  }
  const shown = local ?? error;
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!isComplete(code)) {
      setLocal('Enter all six digits.');
      return;
    }
    setLocal(null);
    onSubmit(code);
  };
  return (
    <form onSubmit={submit} className="flex w-full flex-col items-center gap-6">
      <Heading
        icon="ShieldTick"
        title="Set up your authenticator"
        text={`Staff accounts need an authenticator app. Scan this with Google Authenticator, 1Password or similar for ${email}, then enter the code it shows.`}
      />
      <AuthenticatorQr otpauthUrl={otpauthUrl} secret={secret} />
      <CodeInput
        value={code}
        onChange={(next) => {
          setCode(next);
          setLocal(null);
        }}
        onComplete={(full) => onSubmit(full)}
        invalid={shown !== null}
        busy={busy}
        focusKey={attempt}
      />
      {shown && <ErrorLine>{shown}</ErrorLine>}
      <SubmitButton busy={busy} label="Turn on" />
      <div className="flex w-full justify-end">
        <LinkButton onClick={onBack}>Back to sign in</LinkButton>
      </div>
    </form>
  );
}

/** The backup codes, shown once, before the next step. */
export function SaveCodesStep({ codes, onContinue }: { codes: string[]; onContinue: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Heading
        icon="Key01"
        title="Save your backup codes"
        text="If you lose your phone, each of these signs you in once. They won’t be shown again."
      />
      <BackupCodeList codes={codes} />
      <label className="flex w-full items-center gap-2 text-body-s text-text-secondary">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
          className="size-4 accent-brand-600"
        />
        I’ve saved these codes somewhere safe
      </label>
      <button
        type="button"
        disabled={!saved}
        onClick={onContinue}
        className={cn(adminButton.primary, 'w-full')}
      >
        Continue
      </button>
    </div>
  );
}

/** Replaces the temporary password before the first session. */
export function NewPasswordStep({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [local, setLocal] = useState<string | null>(null);
  const shown = local ?? error;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < STAFF_PASSWORD_MIN) {
      setLocal(`Use at least ${STAFF_PASSWORD_MIN} characters.`);
      return;
    }
    if (password !== again) {
      setLocal('The two passwords don’t match.');
      return;
    }
    setLocal(null);
    onSubmit(password);
  };
  return (
    <form onSubmit={submit} noValidate className="flex w-full flex-col items-center gap-6">
      <Heading
        icon="Lock01"
        title="Choose your password"
        text="Replace the temporary password you were given. Use at least 12 characters; a few unrelated words work well."
      />
      <div className="flex w-full flex-col gap-4">
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setLocal(null);
          }}
          autoFocus
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(event) => {
            setAgain(event.target.value);
            setLocal(null);
          }}
        />
      </div>
      {shown && <ErrorLine>{shown}</ErrorLine>}
      <SubmitButton busy={busy} label="Set password and sign in" />
    </form>
  );
}
