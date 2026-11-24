'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Dialog, DialogHead, DialogHero, dialogBody, dialogFooter, dialogWash } from '@/ui/Dialog';
import { TrashIcon } from '@/ui/icons';
import { Button } from '@/ui/Button';
import { StableLabel } from '@/ui/StableLabel';

/**
 * A yes-or-no before something that matters (RES 04, 867:1366; popup boards, 2026-11-25). The
 * question with its icon bare beside it (a destructive one gets the red bin) or a clay picture over
 * it, one line on what follows, then the safe answer and the action under a rule. The safe answer
 * has the focus; Escape, the backdrop and the × cancel.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmIcon,
  cancelLabel = 'Cancel',
  busyLabel,
  busy = false,
  tone = 'danger',
  icon,
  art,
  aside,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  /** Leads the action's label: a tick on "Yes, I applied". */
  confirmIcon?: ReactNode;
  cancelLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  tone?: 'danger' | 'brand';
  /** Beside the title; a danger question defaults to the bin. */
  icon?: ReactNode;
  /** A clay scene over the title, which centres the words and buttons under it. */
  art?: { src: string; width: number; height: number };
  /** A third answer at the left of the button row: "I won't apply". */
  aside?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  /** What the answer needs or means, under the message: Rename's name, a plan's facts. */
  children?: ReactNode;
}) {
  const shownIcon =
    icon ?? (tone === 'danger' && !art ? <TrashIcon className="text-danger-600" /> : undefined);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && !busy && onCancel()}
      size={art || tone === 'brand' ? 'md' : 'sm'}
      className={art ? undefined : dialogWash}
    >
      {art && <DialogHero {...art} />}
      <div className={cn(dialogBody, art && 'pt-5')}>
        <DialogHead
          icon={art ? undefined : shownIcon}
          title={title}
          line={message}
          center={!!art}
        />
        {children}
      </div>
      <div
        className={cn(
          dialogFooter,
          art && 'justify-center border-t-0 pb-7 pt-2',
          aside && 'justify-between',
        )}
      >
        {aside}
        <div className="flex flex-wrap items-center gap-3">
          <Button autoFocus variant="secondary" size="lg" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          {/* Solid red or brand from the one button map (redesign R3b). */}
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="lg"
            disabled={busy}
            icon={confirmIcon}
            onClick={onConfirm}
          >
            <StableLabel label={confirmLabel} busyLabel={busyLabel ?? confirmLabel} busy={busy} />
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
