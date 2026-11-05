'use client';

import { useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

export type ButtonGroupProps<T extends string> = {
  /** A count after the label, in a neutral badge (the Users board's "Suspended 37"). */
  options: readonly { id: T; label: string; count?: number; countTone?: 'neutral' | 'brand' }[];
  value: T;
  onChange: (value: T) => void;
  /** The group's accessible name: "Generation kind". */
  label: string;
  /** `sm` in a card header (Figma 395:583, 32px), `md` in a table's toolbar (404:838, 36px). */
  size?: 'sm' | 'md';
};

const STEP: Record<string, (at: number, last: number) => number> = {
  ArrowRight: (at, last) => (at >= last ? 0 : at + 1),
  ArrowLeft: (at, last) => (at <= 0 ? last : at - 1),
  Home: () => 0,
  End: (_at, last) => last,
};

/**
 * The admin boards' button group (Figma 395:583): bordered segments, the chosen one on the slate
 * fill. One choice at a time, so it is a radio group: arrow keys move and choose, and only the
 * chosen segment is in the tab order.
 */
export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'sm',
}: ButtonGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = options.findIndex((option) => option.id === value);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[event.key];
    if (!step) return;
    const next = step(at, options.length - 1);
    const option = options[next];
    if (!option) return;
    event.preventDefault();
    onChange(option.id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex shrink-0 overflow-hidden rounded-sm border border-neutral-300 shadow-xs"
    >
      {options.map((option, index) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap text-body-s font-semibold transition-colors duration-press ease-standard',
              // `md` grows with a count badge: 36px plain, 40 with the badge (Figma 404:838).
              size === 'sm' ? 'h-8 px-3' : 'min-h-9 px-3.5 py-2',
              'focus-visible:relative focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600',
              index > 0 && 'border-l border-neutral-300',
              selected
                ? cn('bg-neutral-50', size === 'sm' ? 'text-neutral-800' : 'text-text-primary')
                : 'bg-surface-card text-neutral-700 hover:bg-neutral-50',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-caption-m',
                  option.countTone === 'brand'
                    ? 'border-brand-100 bg-brand-50 text-brand-700'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-700',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
