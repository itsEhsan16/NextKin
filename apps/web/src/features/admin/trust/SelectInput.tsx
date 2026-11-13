'use client';

import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useId } from 'react';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';
import type { AdminIconName } from '@/ui/animated/iconMap';
import { FilterDropdown } from '@/ui/FilterDropdown';
import { Check } from '@/ui/lineIcons';
import { chevronTurn, menuTrigger, tickMotion } from '@/ui/menuMotion';

import { FieldLabel } from '../ui/AdminForm';

export type SelectInputProps<T extends string> = {
  /** The label above the field; omitted where a row's text already names it (Settings' timeout). */
  label?: string;
  /** The accessible name when there is no visible label. */
  ariaLabel?: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** What the field shows, when it isn't the chosen option's own label (a date range). */
  display?: string;
  icon?: AdminIconName;
  className?: string;
};

/**
 * A field that opens a list of choices (the audit log's Date range, Staff, Action and Target type,
 * Figma 408:1698; Settings' session timeout, 409:1729): the boards' 44px input with the value and a
 * chevron, and a one-choice menu under it.
 */
export function SelectInput<T extends string>({
  label,
  ariaLabel,
  options,
  value,
  onChange,
  display,
  icon,
  className,
}: SelectInputProps<T>) {
  const id = useId();
  const chosen = options.find((option) => option.id === value);
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <FieldLabel htmlFor={id}>{label}</FieldLabel>}
      <FilterDropdown
        trigger={
          <button
            id={id}
            type="button"
            aria-label={
              ariaLabel ?? (label ? `${label}: ${display ?? chosen?.label ?? ''}` : undefined)
            }
            className={cn(
              'flex h-11 w-full items-center gap-2 rounded-sm border border-neutral-300 bg-surface-card pl-3.5 pr-3 text-left text-body-m text-text-primary shadow-xs transition-field duration-fast ease-standard hover:bg-neutral-50 focus-visible:border-border-selected focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
              menuTrigger,
            )}
          >
            {icon && <AdminIcon name={icon} className="text-neutral-500" />}
            <span className="min-w-0 flex-1 truncate">{display ?? chosen?.label}</span>
            <AdminIcon name="ChevronDown" className={cn('text-neutral-500', chevronTurn)} />
          </button>
        }
      >
        {/* One choice, so the rows are radios to a screen reader (menuitemradio); they keep the
            filter menus' square box, filled when chosen. */}
        <Dropdown.RadioGroup
          value={value}
          onValueChange={(next) => onChange(next as T)}
          className="max-h-80 overflow-y-auto"
        >
          {options.map((option) => (
            <Dropdown.RadioItem
              key={option.id}
              value={option.id}
              className="group/item flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-body-m text-text-primary outline-none transition-colors duration-press ease-standard data-[highlighted]:bg-surface-muted"
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-tag border border-border-default bg-surface-card text-text-inverse transition-colors duration-press ease-standard group-data-[state=checked]/item:border-brand-600 group-data-[state=checked]/item:bg-brand-600">
                <Dropdown.ItemIndicator className={tickMotion}>
                  <Check aria-hidden className="size-3" />
                </Dropdown.ItemIndicator>
              </span>
              <span className="truncate">{option.label}</span>
            </Dropdown.RadioItem>
          ))}
        </Dropdown.RadioGroup>
      </FilterDropdown>
    </div>
  );
}
