'use client';

import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { useId, useState } from 'react';

import { cn } from '@/lib/cn';
import { CalendarIcon, ChevronDownIcon, ChevronRightIcon } from '@/ui/icons';
import { chevronTurn, menuSurfaceMotion, menuTrigger } from '@/ui/menuMotion';

const PAGE = 12;
/** Far enough ahead for a course still running: a student gives the year they expect to finish. */
const AHEAD = 6;
const EARLIEST = 1950;

const item =
  'flex cursor-pointer items-center justify-center rounded-sm text-body-m text-text-primary outline-none transition-colors duration-press ease-standard data-[highlighted]:bg-surface-muted data-[disabled]:cursor-default data-[disabled]:text-neutral-400';

/** The first of the twelve years on the page that holds `year`, pages counted from 1950. */
const pageStart = (year: number) => year - ((year - EARLIEST) % PAGE);

/**
 * ONB 07's "Year finished" (816:157): a calendar glyph, the year, and a chevron, a third of the
 * column wide. The board never draws it open, so it opens on twelve years with arrows, as From
 * and To open on twelve months.
 */
export function YearField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (year: string) => void;
}) {
  const labelId = useId();
  const valueId = useId();
  const latest = new Date().getFullYear() + AHEAD;
  const shown = value ? Number(value) : new Date().getFullYear();
  const [start, setStart] = useState(() => pageStart(shown));

  return (
    <div className="flex w-44 flex-col gap-1.5">
      <span id={labelId} className="text-body-m font-semibold text-neutral-700">
        {label}
      </span>
      <Dropdown.Root
        onOpenChange={(open) => {
          if (open) setStart(pageStart(shown));
        }}
      >
        <Dropdown.Trigger asChild>
          <button
            type="button"
            aria-labelledby={`${labelId} ${valueId}`}
            className={cn(
              menuTrigger,
              'flex h-control-lg w-full items-center gap-2.5 rounded-lg border border-border-default bg-surface-card pl-3.5 pr-3 text-left',
              'transition-colors duration-press ease-standard hover:border-neutral-400',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 data-[state=open]:border-brand-600 data-[state=open]:bg-surface-brand-strong',
            )}
          >
            <CalendarIcon aria-hidden className="size-3.5 shrink-0 text-text-tertiary" />
            <span
              id={valueId}
              className={cn(
                'min-w-0 flex-1 truncate text-body-l font-medium',
                value ? 'text-text-primary' : 'font-normal text-neutral-400',
              )}
            >
              {value ?? 'Year'}
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
              'z-50 w-60 rounded-md border border-border-default bg-surface-card p-2 shadow-popover outline-none',
              menuSurfaceMotion,
            )}
          >
            <div className="flex items-center justify-between px-1 pb-1">
              <Dropdown.Item
                aria-label="Earlier years"
                disabled={start <= EARLIEST}
                onSelect={(event) => {
                  event.preventDefault();
                  setStart((s) => s - PAGE);
                }}
                className={cn(item, 'size-8')}
              >
                <ChevronRightIcon aria-hidden className="size-4 rotate-180" />
              </Dropdown.Item>
              <span className="text-body-m font-semibold text-text-primary" aria-live="polite">
                {start} – {start + PAGE - 1}
              </span>
              <Dropdown.Item
                aria-label="Later years"
                disabled={start + PAGE > latest}
                onSelect={(event) => {
                  event.preventDefault();
                  setStart((s) => s + PAGE);
                }}
                className={cn(item, 'size-8')}
              >
                <ChevronRightIcon aria-hidden className="size-4" />
              </Dropdown.Item>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: PAGE }, (_, i) => String(start + i)).map((year) => (
                <Dropdown.Item
                  key={year}
                  disabled={Number(year) > latest}
                  onSelect={() => onChange(year)}
                  className={cn(
                    item,
                    'h-8',
                    year === value &&
                      'bg-brand-600 font-semibold text-text-inverse data-[highlighted]:bg-brand-700',
                  )}
                >
                  {year}
                </Dropdown.Item>
              ))}
            </div>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
    </div>
  );
}
