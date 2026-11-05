'use client';

import { useState } from 'react';

import type { AdminDeletionRequest } from '@nextkin/shared/models';
import { useProcessDeletion } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';

import { AdminDialog } from '../../ui/AdminDialog';
import { TextArea } from '../../ui/AdminForm';
import { formatDate, maskUser } from '../peopleFormat';
import { errorText, MAX_NOTE } from './SuspendDialogs';

/** "Purge this account now?": starts a waiting request's purge early, with a reason for the log. */
export function ProcessDeletionDialog({
  request,
  onClose,
}: {
  request: AdminDeletionRequest | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const process = useProcessDeletion();
  const close = () => {
    setReason('');
    onClose();
  };
  return (
    <AdminDialog
      open={request !== null}
      onOpenChange={(open) => !open && close()}
      icon="Trash01"
      tone="danger"
      title="Purge this account now?"
      description={
        request
          ? `Every row ${maskUser(request.userId)} owns is purged now rather than by ${formatDate(request.dueAt)}. This can't be undone and is recorded in the audit log.`
          : undefined
      }
      confirm={{
        label: 'Process now',
        variant: 'danger',
        disabled: reason.trim().length < 3,
        busy: process.isPending,
        onConfirm: () =>
          request &&
          process.mutate(
            { id: request.id, reason },
            {
              onSuccess: () => {
                showToast('Purge started');
                close();
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
