'use client';

import type { ReactNode } from 'react';

import { ADMIN_ROLE_LABEL, type AdminRole } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { FilterDropdown, MenuItem } from '@/ui/FilterDropdown';
import { pressable } from '@/ui/pressable';

import { initialsOf } from '../../format';

/** Each role's avatar tint, as the Staff board draws them (408:2148): Ana L. (Admin) is sky blue. */
const ROLE_TINT: Record<AdminRole, string> = {
  super_admin: 'bg-brand-100 text-brand-700',
  admin: 'bg-info-50 text-info-600',
  curator: 'bg-warning-50 text-warning-600',
  support: 'bg-success-50 text-success-600',
};

/** A staff member in a table cell: initials on the role's tint, the name over the role (406:3226). */
export function StaffCell({ name, role }: { name: string; role: AdminRole }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-900/10 text-caption-m font-semibold',
          ROLE_TINT[role],
        )}
      >
        {initialsOf(name)}
      </span>
      <div className="flex min-w-0 flex-col text-body-s">
        <span className="truncate font-semibold text-text-primary">{name}</span>
        <span className="truncate text-text-secondary">{ADMIN_ROLE_LABEL[role]}</span>
      </div>
    </div>
  );
}

/**
 * The ⋮ on a table row that runs actions rather than opening a page (the price book's and comped
 * access's rows). The boards draw the button, not the menu.
 */
export function RowMenu({
  label,
  items,
}: {
  label: string;
  items: { label: string; onSelect: () => void; tone?: 'default' | 'danger' }[];
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <FilterDropdown
      align="end"
      trigger={
        <button
          type="button"
          aria-label={`More for ${label}`}
          {...hoverProps}
          className={cn(
            'relative flex size-5 shrink-0 items-center justify-center rounded-sm text-neutral-400 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            'after:absolute after:-inset-3 before:absolute before:-inset-1 before:rounded-sm before:transition-colors before:duration-press hover:before:bg-neutral-100',
            pressable,
          )}
        >
          <AdminIcon ref={iconRef} name="DotsVertical" className="relative" />
        </button>
      }
    >
      {items.map((item) => (
        <MenuItem key={item.label} onSelect={item.onSelect} tone={item.tone ?? 'default'}>
          {item.label}
        </MenuItem>
      ))}
    </FilterDropdown>
  );
}

/** A tinted note across the page's foot (406:3463, 408:4017): a glyph, the text and an action. */
export function NoteBar({
  icon,
  tone = 'neutral',
  title,
  children,
  action,
}: {
  icon: AdminIconName;
  tone?: 'neutral' | 'info';
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-md border px-4 py-3.5',
        tone === 'info'
          ? 'items-center border-info-600/35 bg-info-50 text-info-600'
          : 'items-start border-neutral-200 bg-neutral-50 text-neutral-700',
      )}
    >
      <AdminIcon name={icon} className={tone === 'info' ? 'text-info-600' : 'text-neutral-500'} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-body-s">
        {title && <p className="font-semibold">{title}</p>}
        <p>{children}</p>
      </div>
      {action}
    </div>
  );
}

/** An outward link with the ↗ glyph that plays on hover (Open Stripe, Open Stripe dashboard). */
export function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <a href={href} target="_blank" rel="noreferrer" {...hoverProps} className={className}>
      {children}
      <AdminIcon ref={iconRef} name="ArrowUpRight" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** A button whose glyph plays while it is hovered or focused. */
export function IconButton({
  icon,
  className,
  children,
  ...button
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: AdminIconName }) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button type="button" {...hoverProps} {...button} className={className}>
      <AdminIcon ref={iconRef} name={icon} />
      {children}
    </button>
  );
}

/** A small meter on a slate track (408:1245, 408:3766): `share` of the full width, 8px tall. */
export function Track({ share, fill, label }: { share: number; fill: string; label?: string }) {
  const pct = Math.max(0, Math.min(1, share)) * 100;
  return (
    <div
      {...(label
        ? {
            role: 'meter',
            'aria-label': label,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': Math.round(pct),
          }
        : { 'aria-hidden': true })}
      className="h-2 w-full overflow-hidden rounded-full bg-neutral-100"
    >
      <span
        style={{ width: `${pct}%` }}
        className={cn(
          'block h-full animate-meter-grow rounded-full transition-width duration-base ease-standard',
          fill,
        )}
      />
    </div>
  );
}
