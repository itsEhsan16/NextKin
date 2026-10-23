'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { fieldBox } from '@/ui/fieldBox';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { ChevronDownIcon } from '@/ui/icons';
import { chevronTurn, menuTrigger } from '@/ui/menuMotion';

export type SelectFieldProps<V extends string> = {
  /** The field's name, for assistive tech: "Preferred work mode". */
  label: string;
  /** What the choice does, read after the field's name: the id of the line beside it. */
  describedBy?: string;
  /** `null` until something is picked; the field then shows `placeholder` as a grey hint. */
  value: V | null;
  placeholder?: string;
  /** A glyph before the value: the JD upload board's employment type (247:626). */
  leading?: ReactNode;
  options: readonly V[];
  labelOf: (value: V) => string;
  onChange: (value: V) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * One choice from a list, in a field: the Preferences board's work mode, currency, language,
 * date format and time zone (356:42-142). The board never draws one open, so the list is the
 * sort control's menu with the current row ticked, as Update Status's is. Picking closes it.
 */
export function SelectField<V extends string>({
  label,
  describedBy,
  value,
  placeholder = '',
  leading,
  options,
  labelOf,
  onChange,
  disabled,
  className,
}: SelectFieldProps<V>) {
  return (
    <FilterDropdown
      trigger={
        <button
          type="button"
          disabled={disabled}
          aria-label={value == null ? label : `${label}: ${labelOf(value)}`}
          aria-describedby={describedBy}
          className={cn(fieldBox, 'justify-between gap-3 px-3 text-left', menuTrigger, className)}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            {leading}
            <span className={cn('truncate', value == null && 'text-text-tertiary')}>
              {value == null ? placeholder : labelOf(value)}
            </span>
          </span>
          <ChevronDownIcon
            aria-hidden
            className={cn('size-4 shrink-0 text-text-tertiary', chevronTurn)}
          />
        </button>
      }
    >
      {options.map((option) => (
        <FilterCheckboxItem
          key={option}
          checked={option === value}
          closeOnSelect
          onCheckedChange={() => {
            if (option !== value) onChange(option);
          }}
        >
          {labelOf(option)}
        </FilterCheckboxItem>
      ))}
    </FilterDropdown>
  );
}
