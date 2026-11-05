'use client';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import { FilterDropdown, MenuItem } from '@/ui/FilterDropdown';
import { pressable } from '@/ui/pressable';

export type RowMenuItem = {
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
};

/**
 * A row's ⋮ (Figma 406:1472) with the actions the row allows, rather than `CardMenu`'s links: the
 * 20px glyph, a 44px hit area around it, and a menu of actions that run where they are picked.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <FilterDropdown
      align="end"
      trigger={
        <button
          type="button"
          aria-label={`Actions for ${label}`}
          {...hoverProps}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'relative flex size-5 shrink-0 items-center justify-center rounded-sm text-neutral-400 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            'before:absolute before:-inset-1 before:rounded-sm before:transition-colors before:duration-press before:ease-standard hover:before:bg-neutral-100 after:absolute after:-inset-3',
            pressable,
          )}
        >
          <AdminIcon ref={iconRef} name="DotsVertical" className="relative" />
        </button>
      }
    >
      {items.map((item) => (
        <MenuItem
          key={item.label}
          onSelect={item.onSelect}
          tone={item.tone ?? 'default'}
          disabled={item.disabled ?? false}
        >
          {item.label}
        </MenuItem>
      ))}
    </FilterDropdown>
  );
}
