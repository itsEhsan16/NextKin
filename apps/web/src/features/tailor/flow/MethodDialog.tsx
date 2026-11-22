'use client';

import {
  Dialog,
  DialogCloseButton,
  DialogDescription,
  DialogTitle,
  dialogBody,
  dialogFooter,
  dialogLine,
  dialogTitle,
} from '@/ui/Dialog';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { primaryButton } from '@/features/create/jobFlow/FlowChrome';
import { buttonClass } from '@/ui/Button';
import { ArrowRight } from '@/ui/lineIcons';
import { StableLabel } from '@/ui/StableLabel';

/** A tinted row inside the popup: an icon tile, two lines and an action on the right. */
export function DialogFact({
  icon,
  label,
  value,
  aside,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-lg bg-surface-brand px-4 py-3.5">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-card text-text-brand"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-m font-semibold text-text-primary">{label}</p>
        <div className="text-body-m text-text-secondary">{value}</div>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

/**
 * The popup each way to start opens (owner mockup 2026-11-02, toreview §151): its picture, title
 * and line, one fact or field, then Cancel and the way forward. The ticked "what it does" list
 * went (owner, toreview §223); the upload popup has no buttons either (a dropped file is read at
 * once, toreview §221). Its body, × and button row are every dialog's (`ui/Dialog`, §257).
 */
export function MethodDialog({
  open,
  onClose,
  art,
  title,
  line,
  children,
  confirmLabel,
  onConfirm,
  disabled = false,
  busy = false,
  busyLabel,
}: {
  open: boolean;
  onClose: () => void;
  art: string;
  title: string;
  line: string;
  children?: ReactNode;
  /** The way forward; without it the popup has no button row (the upload starts on a drop). */
  confirmLabel?: string;
  onConfirm?: () => void;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()} size="lg">
      <div className={dialogBody}>
        <div className="flex items-start gap-5 pr-12">
          <Image
            src={art}
            alt=""
            width={250}
            height={168}
            className="h-auto w-30 shrink-0 object-contain"
          />
          <div className="flex min-w-0 flex-col gap-1.5 pt-2">
            <DialogTitle className={dialogTitle}>{title}</DialogTitle>
            <DialogDescription className={dialogLine}>{line}</DialogDescription>
          </div>
        </div>
        {/* The rest of the body keeps the popup's own 20px rhythm under its head. */}
        {children && <div className="mt-2 flex flex-col gap-5">{children}</div>}
      </div>
      {!busy && <DialogCloseButton />}

      {confirmLabel && onConfirm && (
        <div className={dialogFooter}>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className={buttonClass({ variant: 'secondary', size: 'lg' })}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={onConfirm}
            className={primaryButton}
          >
            <StableLabel label={confirmLabel} busyLabel={busyLabel ?? confirmLabel} busy={busy} />
            <ArrowRight aria-hidden className="size-4.5" />
          </button>
        </div>
      )}
    </Dialog>
  );
}
