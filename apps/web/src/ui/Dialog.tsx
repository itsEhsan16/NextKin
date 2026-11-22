'use client';

import * as Radix from '@radix-ui/react-dialog';
import { useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { XClose } from '@/ui/lineIcons';

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

/*
 * One inside for every popup (owner, toreview §257: ten dialogs drew ten). The body sits 28px in
 * from the sides and top; the button row is under a rule, 28px in, buttons to the right; the ×
 * sits 20px into the top-right corner. A dialog uses the parts it has.
 */

/** The body: title, line and content, 28px in. Scrolls when the window is short. */
export const dialogBody = 'flex min-h-0 flex-col gap-3 overflow-y-auto px-7 pb-5 pt-7';

/** The title's look, the same in every dialog. */
export const dialogTitle = 'text-h2 font-bold text-text-primary';

/** The line under the title. */
export const dialogLine = 'text-body-l text-text-secondary';

/** The button row: under a rule, buttons to the right; a note, if any, takes the left. */
export const dialogFooter =
  'flex flex-wrap items-center justify-end gap-3 border-t border-border-default px-7 py-4';

/**
 * The × in the top-right corner, for a dialog that is not a yes-or-no question (a confirmation
 * answers with its buttons). Leave room for it with `pr-12` on the title row.
 */
export function DialogCloseButton({ className }: { className?: string }) {
  return (
    <Radix.Close
      aria-label="Close"
      className={cn(
        'absolute right-5 top-5 flex size-9 items-center justify-center rounded-md text-text-tertiary transition-colors duration-press ease-standard hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        className,
      )}
    >
      <XClose aria-hidden className="size-5" />
    </Radix.Close>
  );
}
