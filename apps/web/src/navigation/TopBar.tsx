'use client';

import { useUnreadCount } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';

import { cn } from '@/lib/cn';
import { AiSparkIcon, BellIcon, SearchIcon, UploadIcon } from '@/ui/icons';
import { Menu01 } from '@/ui/lineIcons';
import { pageColumn, topBarHeight } from '@/ui/pageFrame';
import { pressable } from '@/ui/pressable';
import { Soon } from '@/ui/Soon';

import { AccountMenu } from './AccountMenu';
import { OPEN_SIDEBAR_EVENT } from './useSidebarRail';
import { BUTTON_VARIANT } from '@/ui/buttonStyles';

/** A primary action with a `null` destination is an inert button. */
type UploadAction = { label: string; href: Route | null };

/**
 * Every page's primary action unless the page says otherwise: Build Resume, whose first step takes
 * the job (the Upload a JD page went, owner 2026-11-12, toreview §203).
 */
const BUILD_RESUME: UploadAction = { label: 'Build Resume', href: '/create/build' };

/**
 * What the bar says on particular pages; the rest of it is the same everywhere.
 * - Documents' board names its action "Upload New Document", and nothing is behind it yet (§19).
 * - Home, Jobs, Applications, Resumes, Documents, Profile, Help, the AI Assistant and Insights
 *   put their titles
 *   in the bar's band (`pageFrameInBar`), so the bar draws no background there and lets clicks
 *   through everywhere but its controls (§87). Those that scroll take the bar's background back
 *   once the page has moved under it.
 */
const BY_PATH: Record<string, { upload?: UploadAction; inBar?: boolean }> = {
  '/': { inBar: true },
  '/jobs': { inBar: true },
  '/applications': { inBar: true },
  '/resumes': { inBar: true },
  '/documents': { upload: { label: 'Upload New Document', href: null }, inBar: true },
  '/profile': { inBar: true },
  '/help': { inBar: true },
  '/assistant': { inBar: true },
  '/insights': { inBar: true },
  // One page frame for every built page (redesign R7a, audit NT-01).
  '/notifications': { inBar: true },
};

const IN_BAR: { upload?: UploadAction; inBar?: boolean } = { inBar: true };

const uploadAction = cn(
  BUTTON_VARIANT.primary,
  // Below 768 it is the icon alone, in a circle (its words stay for screen readers).
  'h-control-md gap-2 rounded-full px-5 text-body-m font-semibold max-md:w-control-md max-md:px-0',
);

/**
 * The app-wide actions: search, Build Resume, notifications and the avatar, whose menu holds
 * Profile, Settings and Sign out (toreview §164). They sit on a band of
 * their own above every page, pinned while the page scrolls under it (`toreview.md` §28). There is
 * one bar in the `(app)` layout rather than one per page, so it is in the same place everywhere
 * and what is typed into the search survives a navigation.
 *
 * The search opens Jobs with the words typed (redesign R4). Build Resume opens the job step of
 * the one resume flow (`toreview.md` §203).
 */
export function TopBar() {
  const pathname = usePathname();
  const unread = useUnreadCount();

  // A document opened in the viewer starts in the band too (563:1377).
  const page = BY_PATH[pathname] ?? (pathname.startsWith('/documents/') ? IN_BAR : undefined);
  const upload = page?.upload ?? BUILD_RESUME;
  const hasUnread = (unread.data ?? 0) > 0;
  const scrolled = useScrolled(Boolean(page?.inBar));
  const clear = page?.inBar && !scrolled;
  const searchInput = useRef<HTMLInputElement>(null);
  const submitSearch = useGlobalSearch(searchInput);

  return (
    // Named, so a route change's cross-fade leaves the bar still and drawn over the page
    // (`theme.css`, `toreview.md` §84).
    <header
      className={cn(
        'sticky top-0 z-topbar transition-colors duration-base ease-standard',
        clear
          ? 'pointer-events-none bg-transparent'
          : 'bg-neutral-100/80 shadow-hairline-bottom backdrop-blur-md',
        topBarHeight,
      )}
      style={{ viewTransitionName: 'app-topbar' }}
    >
      <div className={cn(pageColumn, 'flex h-full items-end gap-3 pb-2 md:gap-6')}>
        {/* Below 768 there is no rail, so the panel opens from here (redesign R4, audit SH-01). */}
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => window.dispatchEvent(new Event(OPEN_SIDEBAR_EVENT))}
          className={cn(
            'pointer-events-auto flex size-control-md shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-card text-text-secondary shadow-card hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 md:hidden',
            pressable,
          )}
        >
          <Menu01 aria-hidden className="size-5" />
        </button>
        <div className="pointer-events-auto ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          {/* Searches jobs: Enter opens Jobs with the words, and ⌘K / Ctrl+K jumps here (audit
              SH-04: the hint promised both, and neither worked). Below 768 it is the icon. */}
          <form
            role="search"
            onSubmit={submitSearch}
            className="hidden h-control-md w-60 items-center gap-2.5 rounded-full border border-border-subtle bg-surface-card px-4 shadow-card transition-field duration-fast ease-standard focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100 md:flex 2xl:w-80"
          >
            <SearchIcon className="size-4 shrink-0 text-text-tertiary" />
            <input
              ref={searchInput}
              type="search"
              name="q"
              placeholder="Search jobs, skills, companies..."
              aria-label="Search jobs, skills, companies"
              aria-keyshortcuts="Meta+K Control+K"
              className="min-w-0 flex-1 bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary"
            />
            <kbd className="shrink-0 rounded-sm bg-surface-muted px-1.5 py-0.5 font-sans text-micro text-text-tertiary">
              ⌘K
            </kbd>
          </form>
          <Link
            href={'/jobs' as Route}
            aria-label="Search jobs"
            className={cn(
              'flex size-control-md shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-card text-text-secondary shadow-card hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 md:hidden',
              pressable,
            )}
          >
            <SearchIcon className="size-4" />
          </Link>

          {upload.href ? (
            <Link href={upload.href} className={uploadAction}>
              <AiSparkIcon className="size-4" />
              <span className="max-md:sr-only">{upload.label}</span>
            </Link>
          ) : (
            <Soon>
              <button type="button" aria-disabled="true" className={uploadAction}>
                <UploadIcon className="size-4" />
                <span className="max-md:sr-only">{upload.label}</span>
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

/**
 * The bar's search (redesign R4, audit SH-04): Enter opens Jobs filtered by the words, and
 * ⌘K / Ctrl+K focuses the field from anywhere in the app.
 */
function useGlobalSearch(input: RefObject<HTMLInputElement | null>) {
  const router = useRouter();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [input]);
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const words = input.current?.value.trim() ?? '';
    router.push((words ? `/jobs?q=${encodeURIComponent(words)}` : '/jobs') as Route);
  };
}
