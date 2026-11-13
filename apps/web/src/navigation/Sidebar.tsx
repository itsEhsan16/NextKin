'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';

import {
  useApplications,
  useCurrentUser,
  useDocuments,
  useSubscription,
} from '@nextkin/shared/queries';

import { stageOf, type ApplicationStage } from '@/features/applications/applicationStage';
import { cn } from '@/lib/cn';
import { RailTooltipProvider } from '@/ui/RailTooltip';
import { SlidingHighlight } from '@/ui/SlidingHighlight';

import {
  activeIndex,
  isNavItemActive,
  NAV_FOOTER_ITEMS,
  NAV_ITEMS,
  resolveActivePath,
  type NavItem,
  type PendingNav,
} from './navItems';
import { NavRow } from './NavRow';
import { SidebarHeader } from './SidebarHeader';
import { UpgradeCard } from './UpgradeCard';
import { useSidebarRail } from './useSidebarRail';
import { UserChip } from './UserChip';

/** Stages an application doesn't come back from; the rest count toward the nav badge. */
const SETTLED = new Set<ApplicationStage>(['not_selected', 'withdrawn', 'closed']);

/**
 * The authenticated app shell (Figma 304:497 expanded, 304:600 collapsed).
 *
 * Drawn in the older DM Sans / electric-blue language; rendered in Home's token system by
 * agreement, since the two sit side by side in one viewport — and, since the compact pass
 * (`toreview.md` §16), at the app's density rather than the board's: a 240px gutter (a 226 panel)
 * expanded and 72 (58) collapsed. The rows came back up from that pass's 32px when it read as
 * clustered (`toreview.md` §29): 40px rows on a 44px pitch, 14px labels, 20px icons. Whole, the
 * panel needs 735px of window height, so two window-height steps in `theme.css` give way first:
 * `short` hides the Upgrade card's description (fits 1536×730) and `shorter` takes the expanded
 * rows to 36px (fits 1396×670). `--nav-row`, set on the nav, is the one row height `NavRow` and
 * each list's `SlidingHighlight` both read.
 *
 * The board's 5.5px tagline under "NextKin" ("WITH AI THAT WON'T LIE ON YOUR RESUME.") is
 * dropped by request rather than projected onto the ramp — see `toreview.md` §10.2 for the token
 * that existed only for it.
 *
 * The panel is `fixed`: a page taller than the viewport used to drag the whole sidebar up with
 * it. An in-flow spacer of the same width holds the gutter open so `main` still lays out beside
 * it and both animate together when the rail collapses.
 *
 * Every piece of content below the panel's own width — the header title, the bell, the user
 * chip, each row's label and badge, the upgrade card — used to be conditionally rendered on
 * `collapsed` and so popped in/out instantly while the panel kept resizing for another 220ms.
 * They now stay mounted and collapse via `CollapseFade`/`navRowTransition` (defined on
 * `SidebarHeader`, `NavRow`, `UserChip` and `UpgradeCard` — this file is just the shell that
 * lays them out), so the whole thing reads as one motion instead of a box resize with a
 * jump-cut partway through. See `toreview.md` §11 for the specific choices (the row padding,
 * `UpgradeCard`'s `inert` handling, `UserChip`'s rail-only initials).
 *
 * A row lights up the moment it's clicked, not once its route has loaded: `pending` holds the
 * click until the pathname moves (`resolveActivePath`), and each list's highlight glides to it.
 *
 * Which state it is in is CSS, not props (`toreview.md` §84): unprefixed classes draw the panel,
 * `rail:` classes the rail, and `theme.css` decides which applies — the remembered preference
 * from 1280px up (set on `<html>` before the first paint), always the rail below that unless the
 * panel has been opened over the page. `useSidebarRail` mirrors the same answer into React for
 * what CSS can't do (labels, tab order, tooltips).
 */
export function Sidebar() {
  const pathname = usePathname();
  const { rail, overlay, panelRef, toggle, closeOverlay } = useSidebarRail(pathname);

  // Dropped as soon as the pathname moves, so going Back to the page a click left from can't
  // bring the click back with it.
  const [pending, setPending] = useState<PendingNav | null>(null);
  if (pending !== null && pending.from !== pathname) setPending(null);
  const activePath = resolveActivePath(pathname, pending);
  const onNavigate = (href: string) => {
    setPending({ href, from: pathname });
    closeOverlay();
  };

  const user = useCurrentUser();
  const subscription = useSubscription();
  const documents = useDocuments();
  const applications = useApplications();

  // The board draws 3 here, which no subset of the statuses yields, so the badge counts what is
  // still open rather than matching the drawing: every application not Rejected, Withdrawn or
  // Closed, in the Applications page's own terms. See `toreview.md` §10.2 and §17.
  const openApplications = applications.data?.filter((row) => !SETTLED.has(stageOf(row))).length;

  const badgeCounts: Record<string, number | undefined> = {
    applications: openApplications,
    // What the Documents page lists, as its "All Documents (12)" pill counts it (`toreview.md` §19).
    documents: documents.data?.length,
  };

  // 7px of margin either side: 240 - 14 = the 226 panel, 72 - 14 = the 58 rail. Less the 1px
  // border and the nav's padding (12 expanded, 8 collapsed), rows get 200 and 40 — `NavRow`'s
  // two widths, and each list's content box, which its highlight spans. The spacer holds the
  // page's gutter, `--sidebar-gutter` (`theme.css`): it stays 72 when the panel opens over the
  // page on a narrow window.
  return (
    <RailTooltipProvider>
      <div data-sidebar-shell="" data-overlay={overlay || undefined} className="contents">
        {/* Opened over the page (below 1280): a scrim says the page behind is out of reach, and a
            click on it closes the panel (redesign R4, audit SH-05). */}
        {overlay && (
          <div
            aria-hidden
            onClick={closeOverlay}
            className="fixed inset-0 z-sidebar-scrim bg-surface-overlay animate-reveal"
          />
        )}
        <div
          aria-hidden
          className="w-(--sidebar-gutter) shrink-0 transition-width duration-base ease-standard"
        />

        {/* Named, so a route change's cross-fade leaves the sidebar perfectly still (`theme.css`). */}
        <div
          ref={panelRef}
          // Below 768 the panel waits off-canvas until the menu button opens it (redesign R4).
          className="fixed inset-y-0 left-0 z-sidebar w-sidebar-expanded p-sidebar-inset transition-[width,translate] duration-base ease-standard rail:w-[72px] max-md:-translate-x-full max-md:in-data-overlay:translate-x-0"
          style={{ viewTransitionName: 'app-sidebar' }}
        >
          <nav
            aria-label="Main"
            className={cn(
              'flex h-full flex-col overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-border-subtle bg-surface-card shadow-card px-3 py-4 transition-[padding,box-shadow] duration-base ease-standard [--nav-row:var(--spacing-control-lg)] shorter:[--nav-row:var(--spacing-control-md)]',
              // The rail keeps its 40px squares at any height: it is 633px tall, so it never needs
              // the step. Opened over the page, the panel floats on the popover shadow.
              'rail:px-2 rail:py-3 rail:[--nav-row:var(--spacing-control-lg)] in-data-overlay:shadow-popover',
            )}
          >
            <SidebarHeader collapsed={rail} onToggle={toggle} />

            <UserChip
              name={user.data ? `${user.data.firstName} ${user.data.lastName}` : undefined}
              plan={subscription.data?.plan === 'pro' ? 'Pro plan' : 'Free plan'}
              loading={user.isPending}
              collapsed={rail}
            />

            <NavList
              items={NAV_ITEMS}
              activePath={activePath}
              collapsed={rail}
              counts={badgeCounts}
              onNavigate={onNavigate}
              className="mt-3"
            />

            <div className="mt-auto flex w-full flex-col gap-2 pt-3">
              <UpgradeCard collapsed={rail} />

              <div className="w-full border-t border-border-subtle transition-width duration-base ease-standard rail:w-8" />

              <NavList
                items={NAV_FOOTER_ITEMS}
                activePath={activePath}
                collapsed={rail}
                onNavigate={onNavigate}
              />
            </div>
          </nav>
        </div>
      </div>
    </RailTooltipProvider>
  );
}

type NavListProps = {
  items: readonly NavItem[];
  activePath: string;
  collapsed: boolean;
  counts?: Record<string, number | undefined>;
  onNavigate: (href: string) => void;
  className?: string;
};

/**
 * One list of rows, and the highlight that glides behind them. The highlight renders first in a
 * `relative` wrapper, and the `<ul>` is `relative` too, so the rows paint over it.
 */
function NavList({ items, activePath, collapsed, counts, onNavigate, className }: NavListProps) {
  return (
    <div className={cn('relative w-full', className)}>
      {/* The current row's look: the panel's lavender pill, or the ring on the rail. It steps by
          the rows' own height and the list's gap. */}
      <SlidingHighlight
        index={activeIndex(items, activePath)}
        row="var(--nav-row)"
        gap="var(--spacing)"
        className="rounded-md border border-transparent bg-border-brand rail:border-brand-600 rail:bg-transparent"
      />

      {/* `<li>` is constant — `w-fit` shrink-wraps it to whatever width the Link inside it
          currently renders at, and `mx-auto` centres that within the row. Both keep working
          correctly frame-by-frame as the Link's own (explicit-pixel, never percentage) width
          eases between 40px and 200px in `NavRow`, with no toggled `align-items` needed: a
          `<li>` sized by a `width: 100%` child inside a shrink-wrapping parent is a circular
          reference CSS resolves by falling back to `auto`, which is what made the row's
          width jump instantly instead of easing — nav's own `items-center`/`items-stretch`
          toggle was doing the exact same thing one level up. The gap is the token the
          highlight's arithmetic adds to each row. */}
      <ul className="relative flex w-full flex-col gap-1">
        {items.map((item) => (
          <li key={item.key} className="mx-auto w-fit">
            <NavRow
              item={item}
              collapsed={collapsed}
              active={isNavItemActive(item.href, activePath)}
              count={item.badge ? counts?.[item.badge] : undefined}
              onNavigate={() => onNavigate(item.href)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
