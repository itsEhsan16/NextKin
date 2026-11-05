'use client';

import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';

export type AdminCardProps = {
  /** Optional: some list pages draw a card title with no glyph. */
  icon?: AdminIconName | undefined;
  title: string;
  /** What sits at the header's right: a badge, a menu, the kind switch. */
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  /** The white body's padding and layout; `p-5` with a column by default. */
  bodyClassName?: string;
};

/**
 * The admin boards' card (Figma 394:536): a slate tray holding a header — icon, title and whatever
 * the card puts on the right — and a white body inset 4px from the tray's edges. Hovering the card
 * plays its header icon. Each card is a labelled region, so a screen reader can jump between them.
 */
export function AdminCard({
  icon,
  title,
  trailing,
  children,
  className,
  bodyClassName,
}: AdminCardProps) {
  const titleId = useId();
  const { iconRef, hoverProps } = useIconHover();

  return (
    <section
      aria-labelledby={titleId}
      onMouseEnter={hoverProps.onMouseEnter}
      onMouseLeave={hoverProps.onMouseLeave}
      className={cn(
        'flex min-w-0 flex-col rounded-lg border border-neutral-200 bg-neutral-50 px-1 pb-1',
        className,
      )}
    >
      <header className="flex min-h-[46px] items-center gap-2 py-3 pl-3.5 pr-2.5">
        {icon && <AdminIcon ref={iconRef} name={icon} size="md" className="text-neutral-500" />}
        <h2
          id={titleId}
          className="min-w-0 flex-1 truncate text-body-m font-semibold text-neutral-700"
        >
          {title}
        </h2>
        {trailing}
      </header>
      <div
        className={cn(
          'flex flex-1 flex-col rounded-md border border-neutral-200 bg-surface-card p-5 shadow-xs',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** The muted line a card shows where its source serves no data yet (`toreview.md` §171). */
export function NotConnected({ what }: { what: string }) {
  return (
    <div className="flex flex-1 animate-reveal flex-col items-center justify-center gap-1 py-8 text-center">
      <p className="text-body-s font-semibold text-neutral-700">Not connected yet</p>
      <p className="max-w-64 text-body-s text-text-tertiary">
        The backend doesn’t report {what} yet.
      </p>
    </div>
  );
}

/** A card's empty state: nothing to show in this window. */
export function CardEmpty({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-1 animate-reveal flex-col items-center justify-center gap-1 py-8 text-center">
      <p className="text-body-s font-semibold text-neutral-700">{title}</p>
      <p className="max-w-64 text-body-s text-text-tertiary">{message}</p>
    </div>
  );
}
