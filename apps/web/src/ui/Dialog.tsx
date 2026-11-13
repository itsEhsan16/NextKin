'use client';

import * as Radix from '@radix-ui/react-dialog';
import { useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

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
  sm: 'w-dialog-sm',
  /** Consent, notices, accuracy, verify email. */
  md: 'w-dialog-md',
  /** Pickers and method choice. */
  lg: 'w-dialog-lg',
  /** Create resume, with its template grid. */
  xl: 'w-dialog-xl',
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
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...content
}: DialogProps) {
  // Where focus was when the dialog opened, so closing it puts the keyboard user back in place.
  // Radix only does this for its own `Trigger`, and every dialog here opens from app state, so
  // focus used to fall to the page body (found on the R3d showcase).
  const returnTo = useRef<HTMLElement | null>(null);
  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <Radix.Portal>
        <Radix.Overlay className={OVERLAY} />
        <Radix.Content
          className={cn(PANEL, SIZE[size], className)}
          onOpenAutoFocus={(event) => {
            const active = document.activeElement;
            returnTo.current = active instanceof HTMLElement ? active : null;
            onOpenAutoFocus?.(event);
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            const target = returnTo.current;
            returnTo.current = null;
            if (!event.defaultPrevented && target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
          {...content}
        >
          {children}
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}

export const DialogTitle = Radix.Title;
export const DialogDescription = Radix.Description;
export const DialogClose = Radix.Close;
