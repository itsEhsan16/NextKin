'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useAdminMe, useServiceStatus } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { http, USES_BACKEND } from '@/lib/dataSource';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { pressable } from '@/ui/pressable';
import { Soon } from '@/ui/Soon';

import { adminSoon } from '../ui/adminButton';

import { AdminBadge } from '../ui/AdminBadge';
import { useAdminCrumbValue } from './adminCrumb';
import { activeAdminItem, crumbFor } from './adminNav';
import { StaffAvatar } from './StaffCard';

const loadStatus = USES_BACKEND ? () => http.request('/health/features') : null;

const iconButton = cn(
  'relative flex size-10 shrink-0 after:absolute after:-inset-0.5 items-center justify-center rounded-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-brand-600',
  pressable,
);

export type AdminTopBarProps = {
  /** Opens the sidebar over the page on a narrow window; `null` hides the button. */
  onOpenNav: (() => void) | null;
};

/**
 * The admin top bar (Figma 401:1530): where the page sits (Home › group › page), whether the
 * platform is healthy, help, notifications and the staff avatar. The status pill reads the same
 * `/health/features` the user app's degraded banner does; the mock has no outages to report.
 */
export function AdminTopBar({ onOpenNav }: AdminTopBarProps) {
  const pathname = usePathname();
  const item = activeAdminItem(pathname);
  // A detail page's own name, last ("People › Users › Aarav Mehta").
  const crumb = useAdminCrumbValue(pathname);
  const me = useAdminMe();
  const status = useServiceStatus(loadStatus);
  const degraded = (status.data?.capabilities ?? []).filter((c) => c.degraded).length;

  return (
    <header className="sticky top-0 z-20 flex h-[73px] items-center gap-3 border-b border-neutral-200 bg-surface-card/90 px-8 backdrop-blur-md">
      {onOpenNav && (
        <IconButton
          icon="Menu01"
          label="Open navigation"
          onClick={onOpenNav}
          className="-ml-3 lg:hidden"
        />
      )}

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-2 text-body-s font-medium text-neutral-600">
          <li className="flex">
            <Link
              href={'/admin' as Route}
              aria-label="Admin home"
              className={cn(
                // 44px of hit area around the 20px glyph (the board's home crumb).
                'relative -m-1 rounded-sm p-1 text-neutral-500 after:absolute after:-inset-2.5 hover:text-neutral-800',
                pressable,
              )}
            >
              <AdminIcon name="HomeLine" />
            </Link>
          </li>
          <li aria-hidden className="flex text-neutral-300">
            <AdminIcon name="ChevronRight" size="sm" />
          </li>
          {/* A foot row with a page crumb (Settings › Security) has no group of its own to name. */}
          {!(crumb && crumbFor(item) === 'Admin') && (
            <>
              <li>{crumbFor(item)}</li>
              <li aria-hidden className="flex text-neutral-300">
                <AdminIcon name="ChevronRight" size="sm" />
              </li>
            </>
          )}
          {crumb && item ? (
            <>
              <li>
                <Link
                  href={item.href}
                  className="rounded-sm hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  {item.label}
                </Link>
              </li>
              <li aria-hidden className="flex text-neutral-300">
                <AdminIcon name="ChevronRight" size="sm" />
              </li>
            </>
          ) : null}
          <li className="min-w-0">
            <span
              aria-current="page"
              className="block truncate rounded-sm bg-neutral-50 px-2 py-1 font-semibold text-neutral-700"
            >
              {crumb ?? item?.label ?? 'Overview'}
            </span>
          </li>
        </ol>
      </nav>

      {/* Only what /health/features reported: nothing while it loads, "unknown" if it failed. The
          mock has no outages, and on the mock the board's pill stands as drawn. */}
      <span role="status">
        {degraded > 0 ? (
          <AdminBadge tone="warning" dot>
            {degraded === 1 ? '1 service degraded' : `${degraded} services degraded`}
          </AdminBadge>
        ) : !loadStatus || status.data?.status === 'ok' ? (
          <AdminBadge tone="success" dot>
            All systems normal
          </AdminBadge>
        ) : status.isError ? (
          <AdminBadge tone="neutral" dot>
            Status unavailable
          </AdminBadge>
        ) : null}
      </span>

      <HelpLink />

      {/* The board draws a bell; staff notifications have no feed yet. */}
      <Soon label="Notifications are coming soon" side="bottom">
        <button
          type="button"
          aria-disabled="true"
          aria-label="Notifications"
          className={cn(iconButton, adminSoon)}
        >
          <AdminIcon name="Bell01" />
        </button>
      </Soon>

      {me.data && <StaffAvatar name={me.data.name} />}
    </header>
  );
}

function HelpLink() {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <Link
      href={'/admin/help' as Route}
      aria-label="Help and runbooks"
      {...hoverProps}
      className={iconButton}
    >
      <AdminIcon ref={iconRef} name="HelpCircle" />
    </Link>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  className,
}: {
  icon: AdminIconName;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...hoverProps}
      className={cn(iconButton, className)}
    >
      <AdminIcon ref={iconRef} name={icon} />
    </button>
  );
}
