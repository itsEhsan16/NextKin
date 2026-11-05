'use client';

import { useState, type FormEvent } from 'react';

import { BACKUP_CODE } from '@nextkin/shared/queries';

import { TextField } from '../ui/AdminForm';
import { CodeInput, isComplete } from './CodeInput';
import { ErrorLine, Heading, LinkButton, SubmitButton } from './SignInParts';

/** The sign-in card's second step (Figma 410:1605): the authenticator's six digits. */
export function CodeStep({
  email,
  busy,
  error,
  attempt,
  onSubmit,
  onClearError,
  onBackup,
  onBack,
}: {
  email: string;
  busy: boolean;
  error: string | null;
  attempt: number;
  onSubmit: (code: string) => void;
  onClearError: () => void;
  onBackup: () => void;
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
        title="Two-step verification"
        text={`Enter the 6-digit code from your authenticator app for ${email}.`}
      />
      <CodeInput
        value={code}
        onChange={(next) => {
          setCode(next);
          setLocal(null);
          onClearError();
        }}
        onComplete={(full) => onSubmit(full)}
        invalid={shown !== null}
        busy={busy}
        focusKey={attempt}
      />
      {shown && <ErrorLine>{shown}</ErrorLine>}
      <SubmitButton busy={busy} label="Verify" />
      <div className="flex w-full items-center gap-3">
        <LinkButton icon="Key01" tone="brand" onClick={onBackup}>
          Use a backup code
        </LinkButton>
        <span className="flex-1" />
        <LinkButton onClick={onBack}>Back to sign in</LinkButton>
      </div>
    </form>
  );
}

/** One of the backup codes saved at set-up, instead of the authenticator. Each works once. */
export function BackupCodeStep({
  email,
  busy,
  error,
  onSubmit,
  onInvalid,
  onAuthenticator,
  onBack,
}: {
  email: string;
  busy: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
  onInvalid: (message: string | null) => void;
  onAuthenticator: () => void;
  onBack: () => void;
}) {
  const [backup, setBackup] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!BACKUP_CODE.test(backup.trim())) {
          onInvalid('Enter a backup code like 4f2a-9c10.');
          return;
        }
        onSubmit(backup.trim().toLowerCase());
      }}
      className="flex w-full flex-col items-center gap-6"
    >
      <Heading
        icon="Key01"
        title="Use a backup code"
        text={`Enter one of the backup codes you saved for ${email}. Each works once.`}
      />
      <div className="w-full">
        <TextField
          label="Backup code"
          autoComplete="one-time-code"
          value={backup}
          onChange={(event) => {
            setBackup(event.target.value);
            onInvalid(null);
          }}
          autoFocus
        />
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
      <SubmitButton busy={busy} label="Verify" />
      <div className="flex w-full items-center gap-3">
        <LinkButton icon="ShieldTick" tone="brand" onClick={onAuthenticator}>
          Use your authenticator
        </LinkButton>
        <span className="flex-1" />
        <LinkButton onClick={onBack}>Back to sign in</LinkButton>
      </div>
    </form>
  );
}
