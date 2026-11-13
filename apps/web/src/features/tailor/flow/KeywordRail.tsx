'use client';

import { KEYWORD_BUCKET_LABEL, type KeywordBucket } from '@nextkin/shared/tailor/keywordRows';
import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { FilterChip } from '@/ui/FilterChip';
import { Code02, Cube01, DotsHorizontal, Grid01, LayersThree01, Users01 } from '@/ui/lineIcons';
import { pressable } from '@/ui/pressable';
import { SlidingHighlight } from '@/ui/SlidingHighlight';

const ICON: Record<KeywordBucket | 'all', ComponentType<SVGProps<SVGSVGElement>>> = {
  all: Grid01,
  technical: Code02,
  soft: Users01,
  tools: LayersThree01,
  domains: Cube01,
  other: DotsHorizontal,
};

type Item = { id: KeywordBucket | undefined; label: string; count: number };

/**
 * The categories beside the keyword table (owner's mockup, 2026-11-11): All, then each group the
 * open tab holds, with its count. A group with none is left out. One wash glides to the picked
 * row (`SlidingHighlight`); when the column is narrow the same choice is a row of chips.
 */
export function KeywordRail({
  total,
  counts,
  active,
  onChange,
}: {
  total: number;
  counts: readonly { bucket: KeywordBucket; count: number }[];
  active: KeywordBucket | undefined;
  onChange: (bucket: KeywordBucket | undefined) => void;
}) {
  const items: Item[] = [
    { id: undefined, label: 'All', count: total },
    ...counts.map((c) => ({ id: c.bucket, label: KEYWORD_BUCKET_LABEL[c.bucket], count: c.count })),
  ];
  const index = items.findIndex((i) => i.id === active);
  return (
    <nav aria-label="Keyword categories" className="min-w-0">
      <div className="flex gap-2 overflow-x-auto pb-1 @2xl/main:hidden">
        {items.map((item) => (
          <FilterChip
            key={item.label}
            label={`${item.label} ${item.count}`}
            active={item.id === active}
            chevron="none"
            aria-pressed={item.id === active}
            onClick={() => onChange(item.id)}
          />
        ))}
      </div>
      <div className="hidden rounded-lg border border-border-subtle bg-surface-card p-3 @2xl/main:block">
        <p className="px-2 pb-3 pt-1 text-body-l font-bold text-text-primary">Categories</p>
        <div className="relative flex flex-col gap-1">
          <SlidingHighlight
            index={index}
            row="var(--spacing-control-lg)"
            gap="var(--spacing)"
            className="rounded-md bg-surface-brand"
          />
          {items.map((item) => {
            const Icon = ICON[item.id ?? 'all'];
            const on = item.id === active;
            return (
              <button
                key={item.label}
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
                    'min-w-6 rounded-full px-1.5 py-0.5 text-center text-caption-m font-semibold transition-colors duration-fast ease-standard',
                    on ? 'bg-surface-card text-brand-600' : 'bg-neutral-100 text-text-secondary',
                  )}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
