'use client';

import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { FilterChip } from '@/ui/FilterChip';
import { pressable } from '@/ui/pressable';
import { SlidingHighlight } from '@/ui/SlidingHighlight';

export type RailItem<T extends string> = {
  id: T;
  label: string;
  count: number;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** How many of `count` the user has answered, shown as "2/5" once any are. */
  answered?: number;
};

/**
 * The categories beside "Choose keywords" (owner, 2026-11-14: "categorized intelligently … all
 * things are in upper part only"): every way to raise the score, each with how many it holds, and
 * the open one's list beside it. One wash glides to the picked row (`SlidingHighlight`); when the
 * column is narrow the same choice is a row of chips.
 */
export function ScoreRail<T extends string>({
  title,
  items,
  active,
  onChange,
}: {
  title: string;
  items: readonly RailItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  const index = items.findIndex((i) => i.id === active);
  const badge = (item: RailItem<T>) =>
    item.answered ? `${item.answered}/${item.count}` : String(item.count);
  return (
    <nav aria-label={title} className="min-w-0">
      <div className="flex gap-2 overflow-x-auto pb-1 @2xl/main:hidden">
        {items.map((item) => (
          <FilterChip
            key={item.id}
            label={`${item.label} ${badge(item)}`}
            active={item.id === active}
            chevron="none"
            aria-pressed={item.id === active}
            onClick={() => onChange(item.id)}
          />
        ))}
      </div>
      <div className="hidden rounded-lg border border-border-subtle bg-surface-card p-3 @2xl/main:block">
        <p className="px-2 pb-3 pt-1 text-body-l font-bold text-text-primary">{title}</p>
        <div className="relative flex flex-col gap-1">
          <SlidingHighlight
            index={index}
            row="var(--spacing-control-lg)"
            gap="var(--spacing)"
            className="rounded-md bg-surface-brand"
          />
          {items.map((item) => {
            const Icon = item.icon;
            const on = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(item.id)}
                className={cn(
                  pressable,
                  'relative flex h-control-lg w-full items-center gap-2.5 rounded-md px-2.5 text-left text-body-m focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
                  on
                    ? 'font-semibold text-brand-600'
                    : 'font-medium text-text-secondary hover:bg-neutral-50',
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span
                  className={cn(
                    'min-w-6 rounded-full px-1.5 py-0.5 text-center text-caption-m font-semibold tabular-nums transition-colors duration-fast ease-standard',
                    on ? 'bg-surface-card text-brand-600' : 'bg-neutral-100 text-text-secondary',
                  )}
                >
                  {badge(item)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
