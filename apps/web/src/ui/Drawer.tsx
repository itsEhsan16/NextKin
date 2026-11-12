'use client';

import * as Radix from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { XClose } from '@/ui/lineIcons';

/**
 * A panel from the right over a dimmed page (redesign R5d, `doc/redesign/02-tokens.md` §4.10):
 * work done in place, with what it is about still in view, as Jobright tailors over the job.
 *
 * Sizes (from 1280): sm 400, md 560, lg 880, xl min(1200px, the window less the sidebar rail and
 * a gutter). Below 1280 every drawer takes the whole window, so it reads as a page. It shares the
 * `Dialog` shell's scrim, stacking and focus rules: focus moves in and is trapped, Escape and the
 * scrim close it, and focus goes back to what opened it.
 */
const SIZE = {
  sm: 'xl:w-drawer-sm',
  md: 'xl:w-drawer-md',
  lg: 'xl:w-drawer-lg',
  xl: 'xl:w-drawer-xl',
} as const;

const OVERLAY =
  'fixed inset-0 z-overlay bg-surface-overlay data-[state=open]:animate-reveal data-[state=closed]:pointer-events-none data-[state=closed]:animate-fade-out';

const PANEL =
  'fixed inset-y-0 right-0 z-modal flex w-full flex-col bg-surface-page shadow-dialog outline-none xl:rounded-l-2xl data-[state=open]:animate-drawer-in data-[state=closed]:pointer-events-none data-[state=closed]:animate-fade-out';

export function Drawer({
  open,
  onOpenChange,
  title,
  size = 'xl',
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names the drawer for screen readers; the content draws its own visible heading. */
  title: string;
  size?: keyof typeof SIZE;
  children: ReactNode;
}) {
  const returnTo = useRef<HTMLElement | null>(null);
  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <Radix.Portal>
        <Radix.Overlay className={OVERLAY} />
        <Radix.Content
          aria-describedby={undefined}
          // Content that draws its own header leaves room for the close button with
          // `in-data-drawer:` (the flow header does).
          data-drawer=""
          className={cn(PANEL, SIZE[size])}
          onOpenAutoFocus={() => {
            const active = document.activeElement;
            returnTo.current = active instanceof HTMLElement ? active : null;
          }}
          onCloseAutoFocus={(event) => {
            const target = returnTo.current;
            returnTo.current = null;
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          <Radix.Title className="sr-only">{title}</Radix.Title>
          <Radix.Close
            aria-label={`Close ${title.toLowerCase()}`}
            className="absolute right-4 top-4 z-raised flex size-control-sm items-center justify-center rounded-full bg-surface-card text-text-secondary shadow-card transition-colors duration-press ease-standard hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <XClose aria-hidden className="size-5" />
          </Radix.Close>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
            {children}
          </div>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}
