'use client';

import { useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

export type DetailTab<T extends string> = { id: T; label: string; count?: number | null };

const STEP: Record<string, (at: number, last: number) => number> = {
  ArrowRight: (at, last) => (at >= last ? 0 : at + 1),
  ArrowLeft: (at, last) => (at <= 0 ? last : at - 1),
  Home: () => 0,
  End: (_at, last) => last,
};

/** The id of a tab, for the panel's `aria-labelledby`. */
export const detailTabId = (base: string, id: string) => `${base}-tab-${id}`;
/** The id of the one panel the tabs control. */
export const detailPanelId = (base: string) => `${base}-panel`;

/**
 * A page's section tabs (User detail, Figma 406:2527): 13px semibold labels over a slate rule, the
 * chosen one indigo with a 2px underline, a count where the board draws one. As drawn, the tabs
 * sit at the top of the 39px strip, so the underline rides just above the rule. A tablist: arrows
 * move between tabs and choose, only the chosen tab is in the tab order, and each tab controls
 * the panel with `detailPanelId(id)`.
 */
export function DetailTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  id,
}: {
  tabs: readonly DetailTab<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** The base for the tabs' and panel's ids. */
  id: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = tabs.findIndex((tab) => tab.id === value);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[event.key];
    if (!step) return;
    const next = step(at, tabs.length - 1);
    const tab = tabs[next];
    if (!tab) return;
    event.preventDefault();
    onChange(tab.id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex h-[39px] items-start gap-5 border-b border-neutral-200"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={detailTabId(id, tab.id)}
            aria-controls={detailPanelId(id)}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-1 pt-0.5 text-body-s font-semibold transition-colors duration-fast ease-standard focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
              // A count's 24px badge sets the line; the label stays centred on it (406:2532).
              tab.count != null ? 'pb-2.5' : 'pb-3',
              selected
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-800',
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-caption-m text-neutral-700">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
