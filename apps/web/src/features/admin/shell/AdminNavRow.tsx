'use client';

import Link from 'next/link';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';

import { AdminBadge } from '../ui/AdminBadge';
import type { AdminNavItem } from './adminNav';

export type AdminNavRowProps = {
  item: AdminNavItem;
  active: boolean;
  count?: number | undefined;
  onNavigate?: () => void;
};

/**
 * One sidebar row (Figma 401:1448 and on): the icon, the label and, for a queue, its count. The
 * current row sits on a white chip with a hairline, as the Users board draws it (404:615); the
 * others take a slate fill on hover. Hovering or focusing the row plays its icon.
 */
export function AdminNavRow({ item, active, count, onNavigate }: AdminNavRowProps) {
  const { iconRef, hoverProps } = useIconHover();
  const hasCount = count != null && count > 0;

  return (
    <Link
      href={item.href}
      onNavigate={onNavigate}
      aria-current={active ? 'page' : undefined}
      {...hoverProps}
      className={cn(
        'flex min-h-[38px] w-full items-center gap-3 rounded-admin-sm border px-3 py-[7px] text-body-m font-semibold',
        'transition-[background-color,border-color,box-shadow,color,scale] duration-base ease-standard active:scale-(--scale-pressed)',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        active
          ? 'border-neutral-200 bg-surface-card text-text-primary shadow-xs'
          : 'border-transparent text-neutral-700 hover:bg-neutral-100',
      )}
    >
      <AdminIcon
        ref={iconRef}
        name={item.icon}
        className={cn(
          'transition-colors duration-base ease-standard',
          active ? 'text-brand-600' : 'text-neutral-500',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {hasCount && item.badge && (
        <AdminBadge tone={item.badge.tone} className="animate-pop-in">
          <span className="sr-only">, </span>
          {count}
          <span className="sr-only"> open</span>
        </AdminBadge>
      )}
    </Link>
  );
}
