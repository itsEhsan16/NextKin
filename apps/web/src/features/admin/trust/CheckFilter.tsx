'use client';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { menuTrigger } from '@/ui/menuMotion';

import { AdminBadge } from '../ui/AdminBadge';
import { adminButton } from '../ui/adminButton';

/**
 * A table toolbar's Filters (Figma 406:1424, 407:1161): a menu of values to tick, and how many are
 * ticked on the button. No values ticked means no filter.
 */
export function CheckFilter<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <FilterDropdown
      align="end"
      trigger={
        <button type="button" {...hoverProps} className={cn(adminButton.secondary, menuTrigger)}>
          <AdminIcon ref={iconRef} name="FilterLines" />
          Filters
          {value.length > 0 && (
            <AdminBadge tone="brand">
              {value.length}
              <span className="sr-only"> on</span>
            </AdminBadge>
          )}
        </button>
      }
    >
      {options.map((option) => (
        <FilterCheckboxItem
          key={option.id}
          checked={value.includes(option.id)}
          onCheckedChange={(on) =>
            onChange(on ? [...value, option.id] : value.filter((id) => id !== option.id))
          }
        >
          {option.label}
        </FilterCheckboxItem>
      ))}
    </FilterDropdown>
  );
}
