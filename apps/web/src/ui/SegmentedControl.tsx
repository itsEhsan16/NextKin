'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type Segment<T extends string> = { id: T; label: string; icon?: ReactNode; title?: string };

export type SegmentedControlProps<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The group's accessible name: "How to show it". */
  label: string;
  /** Segments share the width (a phone's Edit | Preview) instead of hugging their labels. */
  fill?: boolean;
  className?: string;
};

const KEY_STEP: Record<string, (at: number, last: number) => number> = {
  ArrowRight: (at, last) => (at >= last ? 0 : at + 1),
  ArrowLeft: (at, last) => (at <= 0 ? last : at - 1),
  Home: () => 0,
  End: (_at, last) => last,
};

/**
 * Two or three views of one thing (toreview §131): Preview | Text view, Live preview | PDF pages,
 * Edit | Preview. A muted track with the chosen segment raised on it in white. A tablist: arrow
 * keys move and choose, Home and End jump, and only the chosen segment is in the tab order.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
  fill = false,
  className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = segments.findIndex((s) => s.id === value);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEP[event.key];
    if (!step) return;
    const next = step(at, segments.length - 1);
    const segment = segments[next];
    if (!segment) return;
    event.preventDefault();
    onChange(segment.id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'items-center gap-0.5 rounded-md bg-surface-muted p-0.5 text-body-m',
        fill ? 'flex' : 'inline-flex',
        className,
      )}
    >
      {segments.map((segment, i) => {
        const selected = segment.id === value;
        return (
          <button
            key={segment.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            title={segment.title}
            onClick={() => onChange(segment.id)}
            className={cn(
              'flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 font-medium transition-[color,background-color,box-shadow] duration-fast ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              fill && 'flex-1',
              selected
                ? 'bg-surface-card font-semibold text-text-primary shadow-raised'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {segment.icon}
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
