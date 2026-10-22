'use client';

import { cn } from '@/lib/cn';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { ChevronDownIcon, CloseIcon } from '@/ui/icons';
import { chevronTurn, menuTrigger } from '@/ui/menuMotion';

export type ChipsFieldProps = {
  /** The field's name, for assistive tech: "Preferred locations". */
  label: string;
  values: readonly string[];
  /** Everything the menu offers, the chosen values included. */
  options: readonly string[];
  onChange: (values: string[]) => void;
  /** What the field says when nothing is chosen: "Anywhere". */
  placeholder: string;
  disabled?: boolean;
};

/**
 * Several choices in one field: the Preferences board's locations and industries (356:49,
 * 356:62). Each choice is a lavender chip with its ×, and the field's chevron opens the whole list
 * to add or drop one. The board never draws the list open, so it is the filter chips' menu, which
 * stays open while you tick.
 */
export function ChipsField({
  label,
  values,
  options,
  onChange,
  placeholder,
  disabled,
}: ChipsFieldProps) {
  const set = (value: string, on: boolean) =>
    onChange(on ? [...values, value] : values.filter((chosen) => chosen !== value));

  return (
    <div className="flex min-h-control-md w-full min-w-0 items-center gap-1 rounded-md border border-border-default bg-surface-card p-1">
      {values.length > 0 ? (
        <ul aria-label={label} className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {values.map((value) => (
            <li
              key={value}
              className="flex items-center gap-1 rounded-sm bg-surface-brand-strong py-1 pl-2.5 pr-1 text-body-s text-text-primary"
            >
              {value}
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${value}`}
                onClick={() => set(value, false)}
                className="flex size-4 items-center justify-center rounded-full text-text-tertiary transition-colors duration-press ease-standard enabled:hover:bg-surface-card enabled:hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <CloseIcon aria-hidden className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <span className="flex-1 px-2 text-body-m text-text-tertiary">{placeholder}</span>
      )}
      <FilterDropdown
        align="end"
        trigger={
          <button
            type="button"
            disabled={disabled}
            aria-label={`Choose ${label.toLowerCase()}`}
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-sm text-text-tertiary transition-colors duration-press ease-standard enabled:hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              menuTrigger,
            )}
          >
            <ChevronDownIcon aria-hidden className={cn('size-4', chevronTurn)} />
          </button>
        }
      >
        {options.map((option) => (
          <FilterCheckboxItem
            key={option}
            checked={values.includes(option)}
            onCheckedChange={(on) => set(option, on)}
          >
            {option}
          </FilterCheckboxItem>
        ))}
      </FilterDropdown>
    </div>
  );
}
