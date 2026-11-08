'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { usePathname } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';

import { Toaster } from '@/ui/Toaster';

import { useReturnFocus } from '../ui/useReturnFocus';

import { useAdminScale } from './adminScale';
import { AdminSidebar } from './AdminSidebar';
import { ReauthPrompt } from './ReauthPrompt';
import { AdminTopBar } from './AdminTopBar';

/**
 * Every admin page's frame (shell template, Figma 401:1431): the sidebar beside a column holding
 * the top bar and the page. From 1024px the sidebar stays on screen; below that it opens over the
 * page from the top bar's menu button, as a dialog, and closes on a navigation or Escape.
 *
 * Its own layout rather than the user app's `(app)` shell: the admin boards draw a different
 * sidebar, a different top bar and none of the user app's hosts (run watcher, apply ask).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  useAdminScale();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Closing hands focus back to the top bar's menu button, which opened the overlay.
  const returnFocus = useReturnFocus(open);
  const overlay = useRef<HTMLDivElement>(null);

  // A route change closes the overlay (the link's onNavigate does it first; Back does it here).
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    if (open) setOpen(false);
  }

  return (
    // `data-admin-shell` turns on the fit-to-board zoom (`adminScale.ts`). Under zoom a viewport
    // unit is scaled too, so the window's height is `100dvh` divided back by the zoom.
    <div
      data-admin-shell=""
      className="flex min-h-[calc(100dvh/var(--admin-zoom,1))] bg-surface-card"
    >
      <div className="sticky top-0 hidden h-[calc(100dvh/var(--admin-zoom,1))] shrink-0 lg:block">
        <AdminSidebar />
      </div>
      <ReauthPrompt />

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-neutral-900/30 data-[state=open]:animate-reveal data-[state=closed]:pointer-events-none data-[state=closed]:animate-fade-out lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            // Focus lands on the current page's row, not the first focusable item: that is the
            // "coming soon" search, whose tooltip would open and take the first Escape.
            ref={overlay}
            onOpenAutoFocus={(event) => {
              const row =
                overlay.current?.querySelector<HTMLElement>('a[aria-current="page"]') ??
                overlay.current?.querySelector<HTMLElement>('a[href]');
              if (row) {
                event.preventDefault();
                row.focus();
              }
            }}
            onCloseAutoFocus={returnFocus}
            className="fixed inset-y-0 left-0 z-50 shadow-popover outline-none data-[state=open]:animate-rise lg:hidden"
          >
            <Dialog.Title className="sr-only">Admin navigation</Dialog.Title>
            <AdminSidebar onNavigate={() => setOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="@container/admin flex min-w-0 flex-1 flex-col">
        <AdminTopBar onOpenNav={() => setOpen(true)} />
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>
      {/* Confirmations from staff actions (suspended, saved, published). Above the dialogs' z-50,
          so a toast fired while a dialog is open isn't hidden under its overlay. */}
      <div className="relative z-[60]">
        <Toaster />
      </div>
    </div>
  );
}
