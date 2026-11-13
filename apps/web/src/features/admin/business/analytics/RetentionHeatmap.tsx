'use client';

import { useRef, useState, type KeyboardEvent } from 'react';

import type { AnalyticsRetention, CohortCell } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { useChartFocus } from '../../charts/useChartFocus';
import { formatCount, formatRate } from '../../format';

export const WEEKS = 7;
/** The week the product's retention target reads (V2 §2.2), outlined on every row. */
const TARGET_WEEK = 4;

/** A cell's fill: the brand indigo at the rate's own opacity, as the board draws it (407:1702). */
export const fillOf = (rate: number) =>
  `color-mix(in srgb, var(--color-brand-600) ${Math.round(rate * 100)}%, transparent)`;

/** The board's rows (407:1680): a 112px cohort column, then the weeks, 4px apart every way. */
const ROW = 'grid grid-cols-[112px_repeat(7,minmax(0,1fr))] gap-1';

/**
 * The cohort heatmap as an ARIA grid: one tab stop, the arrow keys (and Home/End) move between
 * cells, so the chart doesn't add a stop per cell. Pointing at or moving to a cell says how many
 * of the cohort that was.
 */
export function RetentionHeatmap({ retention }: { retention: AnalyticsRetention }) {
  const { active, bind } = useChartFocus<string>();
  const [at, setAt] = useState({ row: 0, col: 0 });
  const gridRef = useRef<HTMLDivElement>(null);
  const rows = retention.cohorts.length;

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, [number, number]> = {
      ArrowRight: [0, 1],
      ArrowLeft: [0, -1],
      ArrowDown: [1, 0],
      ArrowUp: [-1, 0],
    };
    let next = at;
    const delta = step[event.key];
    if (delta) {
      next = {
        row: Math.min(rows - 1, Math.max(0, at.row + delta[0])),
        col: Math.min(WEEKS - 1, Math.max(0, at.col + delta[1])),
      };
    } else if (event.key === 'Home') next = { row: at.row, col: 0 };
    else if (event.key === 'End') next = { row: at.row, col: WEEKS - 1 };
    else return;
    event.preventDefault();
    setAt(next);
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${next.row}-${next.col}"]`)?.focus();
  };

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label="Retention by weekly sign-up cohort"
      onKeyDown={move}
      className="flex flex-col gap-1"
    >
      <div role="row" className={ROW}>
        <span role="columnheader" className="text-left text-caption-m font-medium text-neutral-600">
          Cohort
        </span>
        {Array.from({ length: WEEKS }, (_, week) => (
          <span
            key={week}
            role="columnheader"
            className={cn(
              'text-center text-caption-m font-medium',
              week === TARGET_WEEK ? 'text-brand-700' : 'text-neutral-600',
            )}
          >
            Week {week}
          </span>
        ))}
      </div>
      {retention.cohorts.map((cohort, row) => (
        <div key={cohort.label} role="row" className={ROW}>
          <span role="rowheader" className="flex flex-col">
            <span className="text-body-s font-semibold text-text-primary">{cohort.label}</span>
            <span className="text-caption-m font-normal text-text-tertiary">
              {formatCount(cohort.users)} users
            </span>
          </span>
          {cohort.weeks.slice(0, WEEKS).map((cell, col) => {
            const key = `${cohort.label}-${col}`;
            const handlers = bind(key);
            return (
              <div
                key={key}
                role="gridcell"
                data-cell={`${row}-${col}`}
                tabIndex={at.row === row && at.col === col ? 0 : -1}
                aria-label={describe(cohort.label, cohort.users, col, cell)}
                {...handlers}
                onFocus={() => {
                  setAt({ row, col });
                  handlers.onFocus();
                }}
                className="group/cell relative rounded-admin-sm outline-none"
              >
                <Swatch
                  cell={cell}
                  week={col}
                  shown={active === key}
                  dimmed={active !== null && active !== key}
                />
                {active === key && 'rate' in cell && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-tooltip w-max -translate-x-1/2 animate-pop-in rounded-sm border border-neutral-200 bg-surface-card px-3 py-1.5 text-caption-m shadow-popover"
                  >
                    <span className="font-semibold text-text-primary">
                      {cohort.label} · Week {col}
                    </span>
                    <span className="text-text-secondary">
                      {' '}
                      · {formatRate(cell.rate, 0)} (
                      {formatCount(Math.round(cell.rate * cohort.users))} of{' '}
                      {formatCount(cohort.users)})
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function describe(label: string, users: number, week: number, cell: CohortCell): string {
  if ('rate' in cell) {
    return `${label} cohort, week ${week}: ${formatRate(cell.rate, 0)}, ${formatCount(Math.round(cell.rate * users))} of ${formatCount(users)}`;
  }
  return `${label} cohort, week ${week}: ${cell.state === 'future' ? 'not yet' : 'not measured'}`;
}

function Swatch({
  cell,
  week,
  shown,
  dimmed,
}: {
  cell: CohortCell;
  week: number;
  shown: boolean;
  dimmed: boolean;
}) {
  const ring =
    'group-focus-visible/cell:ring-2 group-focus-visible/cell:ring-brand-600 group-focus-visible/cell:ring-offset-1';
  if (!('rate' in cell)) {
    return (
      <span
        aria-hidden
        className={cn(
          'flex h-[38px] items-center justify-center rounded-admin-sm border border-neutral-100 bg-neutral-50 text-caption-m text-text-tertiary',
          cell.state === 'future' && 'border-dashed',
          ring,
        )}
      >
        {cell.state === 'unmeasured' ? '—' : ''}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      style={{ backgroundColor: fillOf(cell.rate) }}
      className={cn(
        'flex h-[38px] cursor-default items-center justify-center rounded-admin-sm text-caption-m font-semibold transition-[opacity,box-shadow] duration-fast ease-standard',
        cell.rate >= 0.5 ? 'text-text-inverse' : 'text-text-primary',
        week === TARGET_WEEK && 'border-[1.5px] border-brand-700',
        dimmed && 'opacity-50',
        shown && 'shadow-raised',
        ring,
      )}
    >
      {formatRate(cell.rate, 0)}
    </span>
  );
}
