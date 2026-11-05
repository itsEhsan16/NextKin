'use client';

import { useState } from 'react';

import { useCompPro, useDeleteUser, useSendPasswordReset } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';

import { AdminDialog } from '../../ui/AdminDialog';
import { TextArea } from '../../ui/AdminForm';
import { formatDate } from '../peopleFormat';
import { errorText, MAX_NOTE, type AccountTarget } from './SuspendDialogs';

type DialogProps = {
  user: AccountTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** A reason the server keeps with the audit entry; three characters at least (its schema). */
const MIN_REASON = 3;

/**
 * "Reset password" (Figma 406:2349): a code goes to the user's email through the identity
 * provider. Staff never see or set a password (V2 §7.17).
 */
export function PasswordResetDialog({ user, open, onOpenChange }: DialogProps) {
  const reset = useSendPasswordReset();
  return (
    <AdminDialog
      open={open}
      onOpenChange={onOpenChange}
      icon="Key01"
      tone="brand"
      title={`Send ${user.name} a password reset?`}
      description="They get an email with a code to choose a new password. You never see or set it. This is recorded in the audit log."
      confirm={{
        label: 'Send reset email',
        busy: reset.isPending,
        onConfirm: () =>
          reset.mutate(user.id, {
            onSuccess: () => {
              showToast('Password reset email sent');
              onOpenChange(false);
            },
            onError: (error) => showToast(errorText(error), { tone: 'error' }),
          }),
      }}
    />
  );
}

/**
 * "Delete account" from the danger zone (Figma 406:2526): signed out at once, every owned row
 * purged within 30 days. A reason is required and goes in the audit log.
 */
export function DeleteAccountDialog({ user, open, onOpenChange }: DialogProps) {
  const [reason, setReason] = useState('');
  const remove = useDeleteUser();
  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setReason('');
  };
  return (
    <AdminDialog
      open={open}
      onOpenChange={close}
      icon="Trash01"
      tone="danger"
      title={`Delete ${user.name}'s account?`}
      description="They're signed out everywhere right away, and every row they own is purged within 30 days. This can't be undone."
      confirm={{
        label: 'Delete account',
        variant: 'danger',
        disabled: reason.trim().length < MIN_REASON,
        busy: remove.isPending,
        onConfirm: () =>
          remove.mutate(
            { id: user.id, reason },
            {
              onSuccess: () => {
                showToast(`${user.name}'s account is queued for deletion`);
                close(false);
              },
              onError: (error) => showToast(errorText(error), { tone: 'error' }),
            },
          ),
      }}
    >
      <TextArea
        label="Reason"
        required
        maxLength={MAX_NOTE}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        hint="Saved with the audit entry."
      />
    </AdminDialog>
  );
}

/** "Comp Pro…" (Figma 406:2526): Pro free for the months picked from the menu, with a reason. */
export function CompProDialog({
  user,
  months,
  open,
  onOpenChange,
}: DialogProps & { months: number }) {
  const [reason, setReason] = useState('');
  const comp = useCompPro();
  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setReason('');
  };
  const span = `${months} month${months === 1 ? '' : 's'}`;
  return (
    <AdminDialog
      open={open}
      onOpenChange={close}
      icon="CoinsStacked01"
      tone="brand"
      title={`Comp ${user.name} Pro for ${span}?`}
      description="Pro is free for that time, with no charge in Stripe. Refunds and disputes are handled in Stripe."
      confirm={{
        label: `Comp ${span}`,
        disabled: reason.trim().length < MIN_REASON,
        busy: comp.isPending,
        onConfirm: () =>
          comp.mutate(
            { id: user.id, months, reason },
            {
              onSuccess: ({ until }) => {
                showToast(`${user.name} has Pro until ${formatDate(until)}`);
                close(false);
              },
              onError: (error) => showToast(errorText(error), { tone: 'error' }),
            },
          ),
      }}
    >
      <TextArea
        label="Reason"
        required
        maxLength={MAX_NOTE}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        hint="Saved with the audit entry: a goodwill credit, an outage, a partner."
      />
    </AdminDialog>
  );
}
