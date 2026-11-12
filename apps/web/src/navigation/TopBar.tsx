'use client';

import { useUnreadCount } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/cn';
import { brandButton } from '@/ui/brandButton';
import { BellIcon, SearchIcon, UploadIcon } from '@/ui/icons';
import { pageColumn, topBarHeight } from '@/ui/pageFrame';
import { pressable } from '@/ui/pressable';
import { Soon } from '@/ui/Soon';

import { AccountMenu } from './AccountMenu';

/** A primary action with a `null` destination is an inert button. */
type UploadAction = { label: string; href: Route | null };

/** Every page's primary action unless the page says otherwise: the JD upload page (247:2). */
const UPLOAD_JD: UploadAction = { label: 'Upload New JD', href: '/upload-jd' };

/**
 * What the bar says on particular pages; the rest of it is the same everywhere.
 * - Documents' board names its action "Upload New Document", and nothing is behind it yet (§19).
 * - Home, Jobs, Applications, Resumes, Documents, Profile, the JD upload page, Help, the AI
 *   Assistant and Insights put their titles
 *   in the bar's band (`pageFrameInBar`), so the bar draws no background there and lets clicks
 *   through everywhere but its controls (§87). Those that scroll take the bar's background back
 *   once the page has moved under it. The upload page's "Back to Jobs" went with the move (§93).
 */
const BY_PATH: Record<string, { upload?: UploadAction; inBar?: boolean }> = {
  '/': { inBar: true },
  '/jobs': { inBar: true },
  '/applications': { inBar: true },
  '/resumes': { inBar: true },
  '/documents': { upload: { label: 'Upload New Document', href: null }, inBar: true },
  '/profile': { inBar: true },
  '/upload-jd': { inBar: true },
  '/help': { inBar: true },
  '/assistant': { inBar: true },
  '/insights': { inBar: true },
};

const IN_BAR: { upload?: UploadAction; inBar?: boolean } = { inBar: true };

const uploadAction = cn(
  brandButton,
  'h-control-md gap-2 rounded-full px-5 text-body-m font-semibold',
);

/**
 * The app-wide actions: search, Upload New JD, notifications and the avatar, whose menu holds
 * Profile, Settings and Sign out (toreview §164). They sit on a band of
 * their own above every page, pinned while the page scrolls under it (`toreview.md` §28). There is
 * one bar in the `(app)` layout rather than one per page, so it is in the same place everywhere
 * and what is typed into the search survives a navigation.
 *
 * The search field isn't wired yet: the app-wide search has no results surface. Upload New JD
 * opens the JD upload page (`toreview.md` §23).
 */
export function TopBar() {
  const pathname = usePathname();
  const unread = useUnreadCount();

  // A document opened in the viewer starts in the band too (563:1377).
  const page = BY_PATH[pathname] ?? (pathname.startsWith('/documents/') ? IN_BAR : undefined);
  const upload = page?.upload ?? UPLOAD_JD;
  const hasUnread = (unread.data ?? 0) > 0;
  const scrolled = useScrolled(Boolean(page?.inBar));
  const clear = page?.inBar && !scrolled;

  return (
    // Named, so a route change's cross-fade leaves the bar still and drawn over the page
    // (`theme.css`, `toreview.md` §84).
    <header
      className={cn(
        'sticky top-0 z-topbar transition-colors duration-base ease-standard',
        clear
          ? 'pointer-events-none bg-transparent'
          : 'bg-neutral-100/80 shadow-[0_1px_0_var(--color-border-default)] backdrop-blur-md',
        topBarHeight,
      )}
      style={{ viewTransitionName: 'app-topbar' }}
    >
      <div className={cn(pageColumn, 'flex h-full items-end gap-6 pb-2')}>
        <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-3">
          <label className="flex h-control-md w-[320px] items-center gap-2.5 rounded-full border border-border-subtle bg-surface-card px-4 shadow-card transition-[border-color,box-shadow] duration-fast ease-standard focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100">
            <SearchIcon className="size-4 shrink-0 text-text-tertiary" />
            <input
              type="search"
              placeholder="Search jobs, skills, companies..."
              aria-label="Search jobs, skills, companies"
              className="min-w-0 flex-1 bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary"
            />
            <kbd className="shrink-0 rounded-sm bg-surface-muted px-1.5 py-0.5 font-sans text-micro text-text-tertiary">
              ⌘K
            </kbd>
          </label>

          {upload.href ? (
            <Link href={upload.href} className={uploadAction}>
              <UploadIcon className="size-4" />
              {upload.label}
            </Link>
          ) : (
            <Soon>
              <button type="button" aria-disabled="true" className={uploadAction}>
                <UploadIcon className="size-4" />
                {upload.label}
              </button>
            </Soon>
          )}

          {/* The feed (toreview §148.1). */}
          <Link
            href="/notifications"
            aria-label={hasUnread ? 'Notifications, unread' : 'Notifications'}
            className={cn(
              'relative flex size-control-md shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-card text-text-secondary shadow-card hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              pressable,
            )}
          >
            <BellIcon className="size-[18px]" />
            {hasUnread && (
              <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-danger-dot ring-2 ring-surface-card" />
            )}
          </Link>

          {/* Profile (476:4), Settings and Sign out, from every screen. */}
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

/** Whether the window has scrolled at all; only listened for on a page whose title is in the bar. */
function useScrolled(enabled: boolean) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const update = () => setScrolled(window.scrollY > 0);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, [enabled]);

  return enabled && scrolled;
}
