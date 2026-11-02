'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { primaryButton } from '@/features/create/jobFlow/FlowChrome';
import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';
import { iconButton } from '@/ui/iconButton';
import { ArrowRight, Check, XClose } from '@/ui/lineIcons';
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
 * and line, what it does as a ticked list, one fact or field, then Cancel and the way forward.
 */
export function MethodDialog({
  open,
  onClose,
  art,
  title,
  line,
  points,
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
  points?: readonly string[];
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-text-primary/30 backdrop-blur-xs data-[state=open]:animate-reveal" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(600px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-2xl bg-surface-card p-7 shadow-dialog data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in">
          <div className="flex items-start gap-5 pr-8">
            <Image
              src={art}
              alt=""
              width={250}
              height={168}
              className="h-auto w-30 shrink-0 object-contain"
            />
            <div className="flex min-w-0 flex-col gap-1.5 pt-2">
              <Dialog.Title className="text-h2 font-bold text-text-primary">{title}</Dialog.Title>
              <Dialog.Description className="text-body-l text-text-secondary">
                {line}
              </Dialog.Description>
            </div>
          </div>
          <Dialog.Close
            aria-label="Close"
            disabled={busy}
            className={cn(iconButton, 'absolute right-5 top-5 size-9 rounded-md')}
          >
            <XClose aria-hidden className="size-5 text-text-secondary" />
          </Dialog.Close>

          {points && (
            <ul className="flex flex-col gap-3 rounded-lg bg-surface-brand px-5 py-4">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-body-l text-text-primary">
                  <Check aria-hidden className="mt-0.5 size-4.5 shrink-0 text-text-brand" />
                  {point}
                </li>
              ))}
            </ul>
          )}
          {children}

          <div className="flex flex-wrap justify-end gap-3">
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
