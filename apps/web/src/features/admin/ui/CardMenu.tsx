'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import { FilterDropdown, MenuItem } from '@/ui/FilterDropdown';
import { pressable } from '@/ui/pressable';

export type CardMenuProps = {
  /** What the menu belongs to, for its accessible name: "New signups". */
  label: string;
  items: { label: string; href: Route }[];
  size?: 'sm' | 'md';
};

/**
 * The ⋮ on a card or a row (Figma 382:1004). The boards draw the button and not the menu, so it
 * offers the one onward step each card has: the page that holds the figure's detail.
 */
export function CardMenu({ label, items, size = 'sm' }: CardMenuProps) {
  const router = useRouter();
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
            // The board's bare 18px glyph (395:507), so the header keeps its 46px; the hit area is a
            // 44px square around it (`after:`), and the hover fill sits just outside the glyph.
            'relative flex shrink-0 items-center justify-center rounded-sm text-neutral-400 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            size === 'sm' ? 'size-[18px] after:-inset-[13px]' : 'size-5 after:-inset-3',
            'after:absolute before:absolute before:-inset-1 before:rounded-sm before:transition-colors before:duration-press before:ease-standard hover:before:bg-neutral-100',
            pressable,
          )}
        >
          <AdminIcon
            ref={iconRef}
            name="DotsVertical"
            size={size === 'sm' ? 'md' : 'lg'}
            className="relative"
          />
        </button>
      }
    >
      {items.map((item) => (
        <MenuItem key={item.href} onSelect={() => router.push(item.href)}>
          {item.label}
        </MenuItem>
      ))}
    </FilterDropdown>
  );
}
