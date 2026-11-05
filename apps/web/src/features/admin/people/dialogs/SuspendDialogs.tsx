'use client';

import { useState } from 'react';

import { SUSPEND_REASONS, type SuspendReason } from '@nextkin/shared/models';
import { useReactivateUser, useSuspendUser } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';

import { AdminDialog } from '../../ui/AdminDialog';
import { CheckboxRow, RadioCardGroup, TextArea } from '../../ui/AdminForm';

export type AccountTarget = { id: string; name: string };

type DialogProps = {
  user: AccountTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** The server's cap on a note or reason (`routes/admin.ts`); the field stops there too. */
export const MAX_NOTE = 500;

export const errorText = (error: unknown) =>
  error instanceof Error && error.message ? error.message : 'Something went wrong. Try again.';

/**
 * "Suspend Aarav Mehta?" (Figma 407:2698): a reason code and an internal note are both required;
 * the email to the user is on by default and never carries the note. The server ends every
 * session the user has.
 */
export function SuspendDialog({ user, open, onOpenChange }: DialogProps) {
  const [reason, setReason] = useState<SuspendReason | null>(null);
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const suspend = useSuspendUser();

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setReason(null);
      setNote('');
      setNotify(true);
    }
  };

  return (
    <AdminDialog
      open={open}
      onOpenChange={close}
      icon="UserX01"
      tone="danger"
      title={`Suspend ${user.name}?`}
      description="They're signed out everywhere and can't sign in until you reactivate them. This is recorded in the audit log."
      confirm={{
        label: 'Suspend account',
        variant: 'danger',
        disabled: reason === null || note.trim().length === 0,
        busy: suspend.isPending,
        onConfirm: () => {
          if (!reason) return;
          suspend.mutate(
            { id: user.id, reason, note, notify },
            {
              onSuccess: () => {
                showToast(`${user.name} is suspended`);
                close(false);
              },
              onError: (error) => showToast(errorText(error), { tone: 'error' }),
            },
          );
        },
      }}
    >
      <div className="flex flex-col gap-4">
        <RadioCardGroup
          label="Reason code"
          required
          options={SUSPEND_REASONS}
          value={reason}
          onChange={setReason}
        />
        <TextArea
          label="Internal note"
          required
          maxLength={MAX_NOTE}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          hint="Only staff see this. It's saved with the audit entry."
        />
        <CheckboxRow
          checked={notify}
          onChange={setNotify}
          label="Email the user that their account is suspended"
          description="The email doesn't include your internal note."
        />
      </div>
    </AdminDialog>
  );
}

/**
 * Reactivating mirrors suspending (the board draws only the suspend side): a reason code, an
 * optional note, and the same audit entry.
 */
export function ReactivateDialog({ user, open, onOpenChange }: DialogProps) {
  const [reason, setReason] = useState<SuspendReason | null>(null);
  const [note, setNote] = useState('');
  const reactivate = useReactivateUser();

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setReason(null);
      setNote('');
    }
  };

  return (
    <AdminDialog
      open={open}
      onOpenChange={close}
      icon="UserPlus01"
      tone="success"
      title={`Reactivate ${user.name}?`}
      description="They can sign in again straight away. This is recorded in the audit log."
      confirm={{
        label: 'Reactivate account',
        disabled: reason === null,
        busy: reactivate.isPending,
        onConfirm: () => {
          if (!reason) return;
          reactivate.mutate(
            { id: user.id, reason, note },
            {
              onSuccess: () => {
                showToast(`${user.name} is active again`);
                close(false);
              },
              onError: (error) => showToast(errorText(error), { tone: 'error' }),
            },
          );
        },
      }}
    >
      <div className="flex flex-col gap-4">
        <RadioCardGroup
          label="Reason code"
          required
          options={SUSPEND_REASONS}
          value={reason}
          onChange={setReason}
        />
        <TextArea
          label="Internal note"
          maxLength={MAX_NOTE}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          hint="Only staff see this. It's saved with the audit entry."
        />
      </div>
    </AdminDialog>
  );
}
