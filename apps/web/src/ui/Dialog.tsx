'use client';

import * as Radix from '@radix-ui/react-dialog';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * The one modal shell (redesign R3a, `doc/redesign/02-tokens.md` §4.9): root, portal, scrim and
 * panel, so every dialog shares a width step, corners, shadow, scrim, motion and stacking. Before
 * this, seven dialogs restated it with five widths, three radii, two shadows and two scrims, all at
 * z-50, so a toast could paint under an open dialog's scrim.
 *
 * The panel is a column that never outgrows the window; a dialog passes its own padding, gap and
 * scrolling through `className`. Radix keeps focus trapped, Escape and the backdrop closing (route
 * them through `onOpenChange`), and focus returning to the trigger. Every dialog needs a
 * `DialogTitle`, and a `DialogDescription` or `aria-describedby={undefined}`.
 */
const SIZE = {
  /** Confirm, rename. */
  sm: 'w-[min(480px,calc(100vw-2rem))]',
  /** Consent, notices, accuracy, verify email. */
  md: 'w-[min(560px,calc(100vw-2rem))]',
  /** Pickers and method choice. */
  lg: 'w-[min(640px,calc(100vw-2rem))]',
  /** Create resume, with its template grid. */
  xl: 'w-[min(720px,calc(100vw-2rem))]',
} as const;

export type DialogSize = keyof typeof SIZE;

/** The scrim: one look for every dialog, 40% ink with no blur (02-tokens §2.9). */
const OVERLAY =
  'fixed inset-0 z-overlay bg-surface-overlay data-[state=open]:animate-reveal data-[state=closed]:pointer-events-none data-[state=closed]:animate-fade-out';

const PANEL =
  'fixed left-1/2 top-1/2 z-modal flex max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-surface-raised shadow-dialog data-[state=closed]:pointer-events-none data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in';

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: DialogSize;
  /** The panel's own layout: padding, gap, scrolling. */
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<typeof Radix.Content>, 'className' | 'children'>;

export function Dialog({
  open,
  onOpenChange,
  size = 'md',
  className,
  children,
  ...content
}: DialogProps) {
  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <Radix.Portal>
        <Radix.Overlay className={OVERLAY} />
        <Radix.Content className={cn(PANEL, SIZE[size], className)} {...content}>
          {children}
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}

export const DialogTitle = Radix.Title;
export const DialogDescription = Radix.Description;
export const DialogClose = Radix.Close;
