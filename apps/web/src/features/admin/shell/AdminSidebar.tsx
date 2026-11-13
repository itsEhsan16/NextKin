'use client';

import { usePathname } from 'next/navigation';

import type { AdminPermission } from '@nextkin/shared/models';
import { useAdminMe, useAdminQueues } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import { LogoMarkIllustration } from '@/ui/illustrations';
import { Skeleton } from '@/ui/Skeleton';
import { Soon } from '@/ui/Soon';

import { adminSoon } from '../ui/adminButton';

import { AdminBadge } from '../ui/AdminBadge';
import { activeAdminItem, footerFor, navFor } from './adminNav';
import { AdminNavRow } from './AdminNavRow';
import { StaffCard } from './StaffCard';

/** Until `/admin/me` answers, show nothing a role might not have: the skeleton stands in. */
const NONE: readonly AdminPermission[] = [];

export type AdminSidebarProps = {
  /** Called when a row starts a navigation, so the narrow-window overlay can close. */
  onNavigate?: () => void;
};

/**
 * The admin sidebar, from the shell template every admin board is cloned from (Figma 401:1432):
 * the wordmark and its Admin badge, search, Overview, the four groups, Settings and Help at the
 * foot, and the staff card. Rows a role can't open aren't drawn (`adminNav.ts`). The counts are
 * the work queues the Overview's "Needs attention" lists, from one query.
 */
export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();
  const me = useAdminMe();
  const queues = useAdminQueues();

  const permissions = me.data?.permissions ?? NONE;
  const active = activeAdminItem(pathname);
  const counts = new Map(queues.data?.map((queue) => [queue.key, queue.count]));

  return (
    <nav
      aria-label="Admin"
      // Three bands: the wordmark and search, the rows, and the staff card. Only the rows scroll,
      // so on a short window the card stays at the foot (as MiTow's admin keeps it), and nothing
      // is squeezed: `*:shrink-0` keeps every item its board height.
      className="flex h-full w-[280px] flex-col border-r border-neutral-200 bg-neutral-50 py-6"
    >
      {/* The board's sidebar is one column with a 2px gap between every item (394:537): the
          wordmark, search and spacer here, 2px before the first row, and 2px + the 12px spacer
          + 2px above the staff card. */}
      <div className="flex shrink-0 flex-col gap-0.5 px-4">
        <div className="flex items-center gap-2.5 pb-5 pl-2">
          <span className="flex items-center gap-2">
            <LogoMarkIllustration className="h-[34px] w-[33px] shrink-0" />
            {/* The board's wordmark (401:1439) is 20.8 ExtraBold, -2%; enlarged at the owner's
                request (2026-11-05). No type role is this size. */}
            <span className="text-admin-brand text-text-primary">NextKin</span>
          </span>
          <AdminBadge tone="brand" className="px-2.5 py-1 text-body-s">
            Admin
          </AdminBadge>
        </div>

        {/* The board draws a search field here; the portal-wide search has no results surface yet. */}
        <Soon label="Search is coming soon" side="right">
          <button
            type="button"
            aria-disabled="true"
            className={cn(
              'flex h-[42px] w-full items-center gap-2 rounded-sm border border-neutral-300 bg-surface-card pl-3 pr-2.5 text-left shadow-xs',
              adminSoon,
            )}
          >
            <AdminIcon name="SearchLg" className="text-neutral-500" />
            <span className="flex-1 text-body-m text-text-tertiary">Search</span>
            <kbd className="rounded-tag border border-neutral-200 px-[5px] py-px font-sans text-caption-m text-neutral-400">
              ⌘K
            </kbd>
          </button>
        </Soon>

        <div className="h-4 shrink-0" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-0.5 [scrollbar-width:thin]">
        <div className="flex min-h-full flex-col gap-0.5 *:shrink-0">
          {me.isError && !me.data ? (
            // Without the role there is nothing honest to show: say so rather than hide the rows.
            <div role="alert" className="flex flex-col gap-1 px-3 py-2 text-body-s">
              <span className="font-semibold text-neutral-800">Couldn’t load your access</span>
              <span className="text-text-secondary">
                The pages your role can open will show here.
              </span>
              <button
                type="button"
                onClick={() => void me.refetch()}
                className="self-start rounded-sm font-semibold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                Try again
              </button>
            </div>
          ) : me.isPending ? (
            <div className="flex flex-col gap-2" aria-hidden>
              {Array.from({ length: 9 }, (_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            navFor(permissions).map((group) => (
              <div key={group.label ?? 'top'} className="flex flex-col gap-0.5 animate-reveal">
                {group.label && (
                  <h2 className="pb-1.5 pl-3 pt-4 text-caption-m font-semibold text-text-tertiary">
                    {group.label}
                  </h2>
                )}
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <li key={item.key}>
                      <AdminNavRow
                        item={item}
                        active={active?.key === item.key}
                        count={item.badge ? counts.get(item.badge.queue) : undefined}
                        {...(onNavigate ? { onNavigate } : {})}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}

          <div className="min-h-6 grow" />

          <ul className="flex flex-col gap-0.5">
            {footerFor(permissions).map((item) => (
              <li key={item.key}>
                <AdminNavRow
                  item={item}
                  active={active?.key === item.key}
                  {...(onNavigate ? { onNavigate } : {})}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-4">
        <StaffCard
          me={me.data}
          loading={me.isPending}
          error={me.isError}
          onRetry={() => void me.refetch()}
        />
      </div>
    </nav>
  );
}
