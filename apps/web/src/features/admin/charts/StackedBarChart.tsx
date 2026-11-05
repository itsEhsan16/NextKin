'use client';

import { useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react';

import {
  ADMIN_GENERATION_KIND_LABEL,
  ADMIN_GENERATION_KINDS,
  type AdminGenerationKind,
  type GenerationDay,
} from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { formatCount, formatDay, formatRate } from '../format';
import { chartScale } from './scale';

/** The board's ramp, darkest at the base (Figma 395:640–644). */
export const KIND_FILL: Record<AdminGenerationKind, string> = {
  resume: 'bg-brand-700',
  tailor: 'bg-brand-500',
  cover_letter: 'bg-brand-300',
  ats_check: 'bg-brand-200',
  interview: 'bg-brand-100',
};

export type StackedBarChartProps = {
  days: readonly GenerationDay[];
  /** Every kind stacked, or one kind alone. */
  kind: AdminGenerationKind | 'all';
};

const runsOf = (day: GenerationDay, kinds: readonly AdminGenerationKind[]) =>
  kinds.reduce((sum, kind) => sum + day.runs[kind], 0);

/** The tooltip's width, and its offset from the column's edge (Figma 395:718, 8px off 395:639). */
const TOOLTIP_WIDTH = 196;
const TOOLTIP_OFFSET = 3;

/**
 * Whether a column's tooltip would run past the plot's right edge, so it opens to the left. The
 * board's Nov 1 tooltip opens to the right; only the last few days have no room for it.
 */
function opensLeft(event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>): boolean {
  const column = event.currentTarget.getBoundingClientRect();
  const plot = event.currentTarget.parentElement?.getBoundingClientRect();
  return !!plot && column.right + TOOLTIP_OFFSET + TOOLTIP_WIDTH > plot.right;
}

/**
 * AI runs per day (Figma 395:628): one column a day, its kinds stacked darkest first, on a
 * gridded scale. Hovering or focusing a column lifts its slate backing and opens the day's
 * breakdown, failures included, as the board's Sat Nov 1 tooltip draws it. Every other day is
 * labelled, and the one in focus always is.
 */
export function StackedBarChart({ days, kind }: StackedBarChartProps) {
  const [focus, setFocus] = useState<number | null>(null);
  const [flip, setFlip] = useState(false);
  const show = (index: number) => (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    setFlip(opensLeft(event));
    setFocus(index);
  };
  const kinds = kind === 'all' ? ADMIN_GENERATION_KINDS : [kind];
  const totals = days.map((day) => runsOf(day, kinds));
  const { ticks, top } = chartScale(Math.max(0, ...totals));
  const total = totals.reduce((sum, n) => sum + n, 0);
  const at = (value: number) => `${(value / top) * 100}%`;

  return (
    <div
      role="group"
      aria-label={`Runs per day over the last ${days.length} days, ${formatCount(total)} in all`}
      className="flex flex-col"
      onMouseLeave={() => setFocus(null)}
    >
      <div className="flex h-64 gap-3">
        <div aria-hidden className="relative w-7 shrink-0">
          {ticks.map((tick) => (
            <span
              key={tick}
              style={{ bottom: at(tick) }}
              className="absolute left-0 translate-y-1/2 text-caption-m font-normal text-text-tertiary"
            >
              {formatCount(tick)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {ticks.map((tick) => (
            <div
              key={tick}
              aria-hidden
              style={{ bottom: at(tick) }}
              // The board draws each line just under its value, the 0 line under the bars' feet.
              className={cn(
                'absolute inset-x-0 h-px translate-y-full',
                tick === 0 ? 'bg-neutral-200' : 'bg-neutral-100',
              )}
            />
          ))}

          <ol className="absolute inset-0 flex items-end">
            {days.map((day, index) => {
              const shown = focus === index;
              const runs = totals[index] ?? 0;
              return (
                <li
                  key={day.date}
                  tabIndex={0}
                  aria-label={
                    kinds.length > 1
                      ? `${formatDay(day.date, true)}: ${formatCount(runs)} runs, ${day.failed} failed`
                      : `${formatDay(day.date, true)}: ${formatCount(runs)} runs`
                  }
                  onMouseEnter={show(index)}
                  onFocus={show(index)}
                  onBlur={() => setFocus(null)}
                  className="group/day relative flex h-full flex-1 items-end justify-center outline-none"
                >
                  <span
                    aria-hidden
                    className={cn(
                      // The board's hover column: 5px in from the column, from 8px above the plot.
                      'absolute inset-x-[5px] -top-2 bottom-0 rounded-sm transition-colors duration-fast ease-standard group-focus-visible/day:ring-2 group-focus-visible/day:ring-brand-600',
                      shown ? 'bg-neutral-50' : 'bg-transparent',
                    )}
                  />
                  <span
                    aria-hidden
                    style={{
                      height: at(runs),
                      animationDelay: `calc(${index} * var(--stagger-step))`,
                    }}
                    className="relative flex w-[35px] max-w-[62%] origin-bottom animate-bar-grow flex-col-reverse overflow-hidden rounded-t-[4px] transition-[height] duration-base ease-standard"
                  >
                    {kinds.map((k) => (
                      <span
                        key={k}
                        style={{ height: `${runs ? (day.runs[k] / runs) * 100 : 0}%` }}
                        className={cn(
                          'w-full shrink-0 transition-[height] duration-base ease-standard',
                          KIND_FILL[k],
                        )}
                      />
                    ))}
                  </span>
                  {shown && <DayTooltip day={day} kinds={kinds} flip={flip} />}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div aria-hidden className="flex gap-3 pb-3 pt-3.5">
        <span className="w-7 shrink-0" />
        <div className="flex min-w-0 flex-1">
          {days.map((day, index) => (
            <span
              key={day.date}
              className={cn(
                'flex-1 whitespace-nowrap text-center text-caption-m font-normal transition-colors duration-fast ease-standard',
                focus === index ? 'font-semibold text-text-primary' : 'text-text-tertiary',
                focus !== index && index % 2 === 1 && 'invisible',
              )}
            >
              {formatDay(day.date)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayTooltip({
  day,
  kinds,
  flip,
}: {
  day: GenerationDay;
  kinds: readonly AdminGenerationKind[];
  flip: boolean;
}) {
  const runs = runsOf(day, kinds);
  return (
    <div
      role="tooltip"
      className={cn(
        // 40px below the plot's top, 8px clear of the hover column (Figma 395:718).
        'pointer-events-none absolute top-10 z-10 flex w-[196px] animate-pop-in flex-col gap-1.5 rounded-sm border border-neutral-200 bg-surface-card px-3 py-2.5 shadow-popover',
        flip ? 'right-[calc(100%+3px)]' : 'left-[calc(100%+3px)]',
      )}
    >
      <p className="text-caption-m font-semibold text-text-primary">
        {formatDay(day.date, true)} · {formatCount(runs)} runs
      </p>
      {kinds.map((kind) => (
        <TooltipRow key={kind} swatch={KIND_FILL[kind]} label={ADMIN_GENERATION_KIND_LABEL[kind]}>
          {formatCount(day.runs[kind])}
        </TooltipRow>
      ))}
      {/* A day's failures are counted across kinds, so they show only while every kind does. */}
      {kinds.length > 1 && (
        <div className="border-t border-neutral-100 pt-1">
          <TooltipRow swatch="bg-danger-600" label="Failed" danger>
            {day.failed} · {formatRate(runs ? day.failed / runs : 0)}
          </TooltipRow>
        </div>
      )}
    </div>
  );
}

function TooltipRow({
  swatch,
  label,
  danger,
  children,
}: {
  swatch: string;
  label: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-caption-m">
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', swatch)} />
      <span className="flex-1 font-normal text-text-secondary">{label}</span>
      <span className={cn('font-semibold', danger ? 'text-danger-600' : 'text-text-primary')}>
        {children}
      </span>
    </div>
  );
}
