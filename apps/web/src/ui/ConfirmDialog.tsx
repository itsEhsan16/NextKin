'use client';

import { Dialog, DialogDescription, DialogTitle } from '@/ui/Dialog';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { TrashIcon } from '@/ui/icons';
import { outlineButton } from '@/ui/outlineButton';
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
      <div className="flex flex-col gap-3 px-7 pb-4 pt-7">
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
      <div className="flex flex-wrap justify-end gap-3 px-7 pb-7 pt-3">
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={onCancel}
          className={cn(outlineButton, 'h-control-lg rounded-md px-5 text-body-l font-semibold')}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={cn(
            'inline-flex h-control-lg items-center justify-center rounded-md px-5 text-body-l font-semibold text-text-inverse transition-colors duration-press ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60',
            tone === 'danger'
              ? 'bg-danger-600 hover:bg-danger-text focus-visible:outline-danger-600'
              : 'bg-brand-600 hover:bg-brand-700 focus-visible:outline-brand-600',
          )}
        >
          <StableLabel label={confirmLabel} busyLabel={busyLabel ?? confirmLabel} busy={busy} />
        </button>
      </div>
    </Dialog>
  );
}
