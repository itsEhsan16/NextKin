'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useAdminReauthenticate } from '@nextkin/shared/queries';
import { ApiError } from '@nextkin/shared/repos';

import { showToast } from '@/lib/toast';

import { CodeInput, isComplete } from '../signin/CodeInput';
import { AdminDialog } from '../ui/AdminDialog';

/** The server's answer to a sensitive action once the authenticator was proven too long ago. */
const needsReauth = (error: unknown) =>
  error instanceof ApiError &&
  typeof error.details === 'object' &&
  error.details !== null &&
  (error.details as { reauthRequired?: unknown }).reauthRequired === true;

/**
 * Settings › Re-authenticate for sensitive actions (toreview §171.13). When the server refuses a
 * sensitive action (inviting or resetting staff, roles, the access policy, backup codes) because
 * the authenticator was last proven more than 15 minutes ago, this asks for a fresh code. The
 * action itself isn't replayed: its own error already showed, so the prompt says to try again.
 */
export function ReauthPrompt() {
  const client = useQueryClient();
  const reauth = useAdminReauthenticate();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('      ');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(
    () =>
      client.getMutationCache().subscribe((event) => {
        if (event.type !== 'updated' || event.action.type !== 'error') return;
        if (!needsReauth(event.action.error)) return;
        setCode('      ');
        setError(null);
        setOpen(true);
      }),
    [client],
  );

  const submit = (full = code) => {
    if (!isComplete(full)) {
      setError('Enter all six digits.');
      return;
    }
    reauth.mutate(full, {
      onSuccess: () => {
        setOpen(false);
        showToast('Confirmed. Try that again.');
      },
      onError: () => {
        setError('That code didn’t work. Check your app and try again.');
        setCode('      ');
        setAttempt((count) => count + 1);
      },
    });
  };

  return (
    <AdminDialog
      open={open}
      onOpenChange={setOpen}
      icon="ShieldTick"
      tone="brand"
      title="Confirm it’s you"
      description="This change needs a fresh code from your authenticator app. It covers sensitive changes for the next 15 minutes."
      confirm={{ label: 'Confirm', busy: reauth.isPending, onConfirm: () => submit() }}
    >
      <div className="flex flex-col items-center gap-3">
        <CodeInput
          value={code}
          onChange={(next) => {
            setCode(next);
            setError(null);
          }}
          onComplete={(full) => submit(full)}
          invalid={error !== null}
          busy={reauth.isPending}
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
