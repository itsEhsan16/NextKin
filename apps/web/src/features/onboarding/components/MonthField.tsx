'use client';

import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useId, useState } from 'react';

import { cn } from '@/lib/cn';
import { CalendarIcon, ChevronDownIcon, ChevronRightIcon } from '@/ui/icons';
import { chevronTurn, menuSurfaceMotion, menuTrigger } from '@/ui/menuMotion';

import { currentMonth, MONTH_NAMES, monthKey, monthLabel, parseMonth } from '../months';

export type MonthFieldProps = {
  label: string;
  /** `YYYY-MM`, `'present'` (with `allowPresent`), or `null` until picked. */
  value: string | null;
  onChange: (value: string) => void;
  /** Offer "Present" first: the To field of a role still held (816:31). */
  allowPresent?: boolean;
  /** No month before this one can be picked: To after From. */
  min?: string | null;
  disabled?: boolean;
};

const item =
  'flex cursor-pointer items-center justify-center rounded-sm text-body-m text-text-primary outline-none transition-colors duration-press ease-standard data-[highlighted]:bg-surface-muted data-[disabled]:cursor-default data-[disabled]:text-neutral-400';

/**
 * ONB 05's From and To (816:23, 816:29): a calendar glyph, the month, and a chevron. The board
 * never draws one open, so the menu is a year with arrows over a 3 × 4 grid of months, rather
 * than a list of every month back to school. Months after this one can't be picked.
 */
export function MonthField({
  label,
  value,
  onChange,
  allowPresent = false,
  min,
  disabled = false,
}: MonthFieldProps) {
  const labelId = useId();
  const valueId = useId();
  const now = currentMonth();
  const shown = value && value !== 'present' ? value : (min ?? now);
  const [year, setYear] = useState(() => parseMonth(shown).year);
  const thisYear = parseMonth(now).year;
  const minYear = min ? parseMonth(min).year : thisYear - 60;

  const outOfRange = (key: string) => key > now || (min != null && key < min);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span id={labelId} className="text-body-m font-semibold text-neutral-700">
        {label}
      </span>
      <Dropdown.Root
        onOpenChange={(open) => {
          if (open) setYear(parseMonth(shown).year);
        }}
      >
        <Dropdown.Trigger asChild disabled={disabled}>
          <button
            type="button"
            aria-labelledby={`${labelId} ${valueId}`}
            className={cn(
              menuTrigger,
              'flex h-control-lg w-full items-center gap-2.5 rounded-md border border-border-default bg-surface-card pl-3.5 pr-3 text-left',
              'transition-colors duration-press ease-standard enabled:hover:border-neutral-400 disabled:cursor-default disabled:opacity-60',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 data-[state=open]:border-brand-600 data-[state=open]:bg-surface-brand-strong',
            )}
          >
            <CalendarIcon aria-hidden className="size-3.5 shrink-0 text-text-tertiary" />
            <span
              id={valueId}
              className={cn(
                'min-w-0 flex-1 truncate text-body-l font-medium',
                value ? 'text-text-primary' : 'font-normal text-text-tertiary',
              )}
            >
              {value === 'present' ? 'Present' : value ? monthLabel(value) : 'Month and year'}
            </span>
            <ChevronDownIcon
              aria-hidden
              className={cn('size-4 shrink-0 text-text-tertiary', chevronTurn)}
            />
          </button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content
            align="start"
            sideOffset={6}
            aria-label={label}
            className={cn(
              'z-dropdown w-64 rounded-md border border-border-default bg-surface-card p-2 shadow-popover outline-none',
              menuSurfaceMotion,
            )}
          >
            {allowPresent && (
              <Dropdown.Item
                onSelect={() => onChange('present')}
                className={cn(
                  item,
                  'mb-1 h-8 justify-start px-2 font-semibold',
                  value === 'present' && 'bg-surface-brand-strong text-text-brand',
                )}
              >
                Present
              </Dropdown.Item>
            )}
            <div className="flex items-center justify-between px-1 pb-1">
              <Dropdown.Item
                aria-label="Previous year"
                disabled={year <= minYear}
                onSelect={(event) => {
                  event.preventDefault();
                  setYear((y) => y - 1);
                }}
                className={cn(item, 'size-8')}
              >
                <ChevronRightIcon aria-hidden className="size-4 rotate-180" />
              </Dropdown.Item>
              <span className="text-body-m font-semibold text-text-primary" aria-live="polite">
                {year}
              </span>
              <Dropdown.Item
                aria-label="Next year"
                disabled={year >= thisYear}
                onSelect={(event) => {
                  event.preventDefault();
                  setYear((y) => y + 1);
                }}
                className={cn(item, 'size-8')}
              >
                <ChevronRightIcon aria-hidden className="size-4" />
              </Dropdown.Item>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {MONTH_NAMES.map((name, month) => {
                const key = monthKey(year, month);
                return (
                  <Dropdown.Item
                    key={name}
                    disabled={outOfRange(key)}
                    onSelect={() => onChange(key)}
                    aria-label={`${name} ${year}`}
                    className={cn(
                      item,
                      'h-8',
                      key === value &&
                        'bg-brand-600 font-semibold text-text-inverse data-[highlighted]:bg-brand-700',
                    )}
                  >
                    {name}
                  </Dropdown.Item>
                );
              })}
            </div>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
    </div>
  );
}
