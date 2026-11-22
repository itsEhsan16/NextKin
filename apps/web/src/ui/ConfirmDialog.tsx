'use client';

import { Dialog, DialogDescription, DialogTitle, dialogBody, dialogFooter } from '@/ui/Dialog';
import type { ReactNode } from 'react';

import { TrashIcon } from '@/ui/icons';
import { Button } from '@/ui/Button';
import { StableLabel } from '@/ui/StableLabel';

/**
 * A yes-or-no before something that cannot be undone (RES 04, 867:1366): for a destructive one, a
 * red tile with the bin, the question, one line on what goes with it, then Cancel and the action
 * under a rule. The safe answer has the focus; Escape and the backdrop cancel.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  busyLabel,
  busy = false,
  tone = 'danger',
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  tone?: 'danger' | 'brand';
  onConfirm: () => void;
  onCancel: () => void;
  /** A field the answer needs, under the message: Rename's name. */
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()} size="sm">
      <div className={dialogBody}>
        {tone === 'danger' && (
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-md bg-danger-50 text-danger-600"
          >
            <TrashIcon className="size-5" />
          </span>
        )}
        <DialogTitle className="text-h2 font-bold text-text-primary">{title}</DialogTitle>
        <DialogDescription className="text-body-l text-text-secondary">{message}</DialogDescription>
        {children}
      </div>
      <div className={dialogFooter}>
        <Button autoFocus variant="secondary" size="lg" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
        {/* Solid red or brand from the one button map (redesign R3b); it was hand-rolled. */}
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          size="lg"
          disabled={busy}
          onClick={onConfirm}
        >
          <StableLabel label={confirmLabel} busyLabel={busyLabel ?? confirmLabel} busy={busy} />
        </Button>
      </div>
    </Dialog>
  );
}
