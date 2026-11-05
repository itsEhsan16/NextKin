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
 * The ⋮ at a row's or card's end, opening actions rather than links (the shared `CardMenu` only
 * navigates). A 20px glyph with a 44px hit area, so the row keeps the board's height.
 */
export function RowMenu({
  label,
  actions,
  size = 'md',
}: {
  label: string;
  actions: RowAction[];
  size?: 'sm' | 'md';
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
            'relative flex shrink-0 items-center justify-center rounded-sm text-neutral-400 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            size === 'sm' ? 'size-[18px] after:-inset-[13px]' : 'size-5 after:-inset-3',
            'after:absolute before:absolute before:-inset-1 before:rounded-sm before:transition-colors before:duration-press hover:before:bg-neutral-100',
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
      {actions.map((action) => (
        <MenuItem
          key={action.label}
          onSelect={action.onSelect}
          {...(action.tone ? { tone: action.tone } : {})}
          {...(action.disabled ? { disabled: true } : {})}
        >
          {action.label}
        </MenuItem>
      ))}
    </FilterDropdown>
  );
}
