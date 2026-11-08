'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { Spinner } from '@/ui/Spinner';

import { adminButton } from './adminButton';
import { FeaturedIcon, type FeaturedTone } from './FeaturedIcon';
import { useReturnFocus } from './useReturnFocus';

export type AdminDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: AdminIconName;
  tone: FeaturedTone;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** The confirm button: its label, look and handler. Without it the dialog only has Close. */
  confirm?: {
    label: string;
    /** A glyph before the label (View resume content's Eye, Figma 407:3089). */
    icon?: AdminIconName;
    variant?: 'primary' | 'danger';
    onConfirm: () => void;
    /** Greyed out until the form inside is complete. */
    disabled?: boolean;
    /** The action is running: the button spins and the dialog can't be dismissed. */
    busy?: boolean;
  };
  cancelLabel?: string;
  /** 520 by default (Figma 407:2698); a wider one for content to read (407:2782). */
  width?: 'md' | 'lg';
};

/**
 * The admin boards' modal (Suspend, Figma 407:2698): a featured icon and a close button, the title
 * at 18/28 and a line under it, the form, and Cancel beside the confirm, each half the width.
 * Radix supplies the focus trap, Escape and the labelling; the overlay dims the page.
 */
export function AdminDialog({
  open,
  onOpenChange,
  icon,
  tone,
  title,
  description,
  children,
  confirm,
  cancelLabel = 'Cancel',
  width = 'md',
}: AdminDialogProps) {
  const busy = confirm?.busy ?? false;
  const returnFocus = useReturnFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-[2px] data-[state=open]:animate-reveal data-[state=closed]:pointer-events-none data-[state=closed]:animate-fade-out" />
        <Dialog.Content
          {...(description == null ? { 'aria-describedby': undefined } : {})}
          onCloseAutoFocus={returnFocus}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh/var(--admin-zoom,1)-48px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-lg bg-surface-card p-6 shadow-modal outline-none data-[state=closed]:pointer-events-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in',
            width === 'md' ? 'max-w-[520px]' : 'max-w-[720px]',
          )}
        >
          <div className="flex items-start gap-4">
            <FeaturedIcon name={icon} tone={tone} size="lg" />
            <span className="flex-1" />
            <CloseButton />
          </div>
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-h2 font-semibold leading-7 tracking-[-0.005em] text-text-primary">
              {title}
            </Dialog.Title>
            {description != null && (
              <Dialog.Description className="text-body-s text-text-secondary">
                {description}
              </Dialog.Description>
            )}
          </div>
          {children}
          <div className="flex gap-3 pt-3">
            <Dialog.Close asChild>
              <button type="button" disabled={busy} className={cn(adminButton.secondary, 'flex-1')}>
                {confirm ? cancelLabel : 'Close'}
              </button>
            </Dialog.Close>
            {confirm && (
              <button
                type="button"
                onClick={confirm.onConfirm}
                disabled={confirm.disabled || busy}
                aria-busy={busy || undefined}
                className={cn(
                  confirm.variant === 'danger' ? adminButton.danger : adminButton.primary,
                  'flex-1',
                )}
              >
                {busy ? (
                  <Spinner className="size-4" />
                ) : (
                  confirm.icon && <AdminIcon name={confirm.icon} />
                )}
                {confirm.label}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The 24px ✕ in a dialog's or drawer's corner, with a 44px hit area. */
export function CloseButton() {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <Dialog.Close asChild>
      <button
        type="button"
        aria-label="Close"
        {...hoverProps}
        className="relative flex size-6 items-center justify-center rounded-sm text-neutral-400 transition-colors duration-press hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-brand-600 after:absolute after:-inset-2.5"
      >
        <AdminIcon ref={iconRef} name="XClose" size="xl" />
      </button>
    </Dialog.Close>
  );
}
