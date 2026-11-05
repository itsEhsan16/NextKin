'use client';

import { useState } from 'react';

import type { AbuseReportDetail, ReportAction } from '@nextkin/shared/models';
import { useActOnReport } from '@nextkin/shared/queries';

import { showToast } from '@/lib/toast';

import { AdminDialog } from '../../ui/AdminDialog';
import { RadioCardGroup, TextArea } from '../../ui/AdminForm';
import { masked } from '../trustFormat';
import { ACTION_COPY, REASONS, itemRef } from './reportLabels';

export type ReportActionDialogProps = {
  report: AbuseReportDetail;
  action: ReportAction | null;
  onClose: () => void;
};

/**
 * The reason a report is settled (Figma 407:1418: "Each action asks for a reason code and is
 * written to the audit log with your name"). The reason is required; the note is required for
 * "Other". The reporter is never told who acted.
 */
export function ReportActionDialog({ report, action, onClose }: ReportActionDialogProps) {
  const act = useActOnReport();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [shownFor, setShownFor] = useState<ReportAction | null>(action);
  if (shownFor !== action) {
    setShownFor(action);
    setReason(null);
    setNote('');
  }

  const copy = action ? ACTION_COPY[action] : null;
  const needsNote = reason === 'other';
  const ready = reason !== null && (!needsNote || note.trim().length > 0);

  const describe =
    action === 'dismiss'
      ? `${report.id} closes without changing ${itemRef(report.item)}.`
      : action === 'disable_link'
        ? `${itemRef(report.item)} stops opening for anyone. The owner keeps their resume.`
        : `${masked('user', report.ownerRef)} is signed out everywhere and can’t sign in until reactivated.`;

  const confirm = async () => {
    if (!action || !reason) return;
    try {
      await act.mutateAsync({ id: report.id, action, reason, note: note.trim() });
      showToast(`${report.id} settled: ${ACTION_COPY[action].done}`);
      onClose();
    } catch {
      showToast('That didn’t save. Try again.', { tone: 'error' });
    }
  };

  if (!action || !copy) return null;

  return (
    <AdminDialog
      open
      onOpenChange={(open) => !open && onClose()}
      icon={copy.icon}
      tone={copy.tone}
      title={copy.title}
      description={`${describe} This is recorded in the audit log.`}
      confirm={{
        label: copy.confirm,
        variant: action === 'dismiss' ? 'primary' : 'danger',
        onConfirm: () => void confirm(),
        disabled: !ready,
        busy: act.isPending,
      }}
    >
      <div className="flex flex-col gap-4">
        <RadioCardGroup
          label="Reason code"
          required
          options={REASONS[action]}
          value={reason}
          onChange={setReason}
        />
        <TextArea
          label="Internal note"
          required={needsNote}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          hint="Only staff see this. It’s saved with the audit entry."
        />
      </div>
    </AdminDialog>
  );
}
