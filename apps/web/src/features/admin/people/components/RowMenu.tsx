'use client';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import { FilterDropdown, MenuItem } from '@/ui/FilterDropdown';
import { pressable } from '@/ui/pressable';

export type RowAction = {
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
};

/**
 * A row's or a header's ⋮ (Figma 404:912, 406:2357) with the actions that apply to it. `boxed` is
 * the page header's 42px outlined button; the bare one is a table row's 20px glyph with a 44px
 * hit area.
 */
export function RowMenu({
  label,
  actions,
  boxed = false,
}: {
  /** What the menu acts on, for its accessible name: "Aarav Mehta". */
  label: string;
  actions: RowAction[];
  boxed?: boolean;
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
            'relative flex shrink-0 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            boxed
              ? 'size-[42px] border border-neutral-300 bg-surface-card text-neutral-700 shadow-xs hover:bg-neutral-50'
              : 'size-5 text-neutral-400 after:absolute after:-inset-3 before:absolute before:-inset-1 before:rounded-sm before:transition-colors before:duration-press hover:text-neutral-700 hover:before:bg-neutral-100',
            pressable,
          )}
        >
          <AdminIcon ref={iconRef} name="DotsVertical" className="relative" />
        </button>
      }
    >
      {actions.map((action) => (
        <MenuItem
          key={action.label}
          onSelect={action.onSelect}
          tone={action.tone ?? 'default'}
          disabled={action.disabled ?? false}
        >
          {action.label}
        </MenuItem>
      ))}
    </FilterDropdown>
  );
}
