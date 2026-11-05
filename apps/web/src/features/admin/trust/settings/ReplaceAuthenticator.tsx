'use client';

import { useEffect, useState } from 'react';

import type { AuthenticatorSetup } from '@nextkin/shared/models';
import {
  useBeginAuthenticatorReplacement,
  useConfirmAuthenticatorReplacement,
} from '@nextkin/shared/queries';

import { CodeInput, isComplete } from '../../signin/CodeInput';
import { AdminDialog } from '../../ui/AdminDialog';
import { AuthenticatorQr } from '../../ui/AuthenticatorSetup';

/**
 * Settings › Replace authenticator (toreview §171.13): a new authenticator to scan, confirmed with
 * one code from it. The old one keeps working until the new one is confirmed; new backup codes
 * follow, since the old ones were tied to the old set-up.
 */
export function ReplaceAuthenticatorDialog({
  onClose,
  onReplaced,
}: {
  onClose: () => void;
  onReplaced: (backupCodes: string[]) => void;
}) {
  const begin = useBeginAuthenticatorReplacement();
  const confirm = useConfirmAuthenticatorReplacement();
  const [setup, setSetup] = useState<AuthenticatorSetup | null>(null);
  const [code, setCode] = useState('      ');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { mutate: start } = begin;

  // Mounted only while open (see `MfaCard`), so every opening starts from a fresh set-up.
  useEffect(() => {
    start(undefined, {
      onSuccess: setSetup,
      onError: (failure) =>
        setError(
          failure instanceof Error && failure.message
            ? failure.message
            : 'The new authenticator couldn’t be started. Try again.',
        ),
    });
  }, [start]);

  const submit = (full = code) => {
    if (!setup) return;
    if (!isComplete(full)) {
      setError('Enter all six digits.');
      return;
    }
    confirm.mutate(
      { challenge: setup.challenge, code: full },
      {
        onSuccess: onReplaced,
        onError: () => {
          setError('That code didn’t work. Check the new app and try again.');
          setCode('      ');
          setAttempt((count) => count + 1);
        },
      },
    );
  };

  return (
    <AdminDialog
      open
      onOpenChange={(next) => !next && onClose()}
      icon="ShieldTick"
      tone="brand"
      title="Set up your new authenticator"
      description="Scan this with the new app, then enter the code it shows. Your current app keeps working until you do."
      confirm={{
        label: 'Replace authenticator',
        disabled: !setup,
        busy: confirm.isPending,
        onConfirm: () => submit(),
      }}
    >
      <div className="flex flex-col items-center gap-5">
        {setup ? (
          <AuthenticatorQr otpauthUrl={setup.otpauthUrl} secret={setup.secret} />
        ) : (
          <div aria-hidden className="size-44 animate-pulse rounded-md bg-neutral-100" />
        )}
        <CodeInput
          value={code}
          onChange={(next) => {
            setCode(next);
            setError(null);
          }}
          onComplete={(full) => submit(full)}
          invalid={error !== null}
          busy={confirm.isPending}
          focusKey={attempt}
        />
        {error && (
          <p role="alert" className="text-center text-body-s text-danger-600">
            {error}
          </p>
        )}
      </div>
    </AdminDialog>
  );
}
