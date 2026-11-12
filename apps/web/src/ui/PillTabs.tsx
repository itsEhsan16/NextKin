'use client';

import { cn } from '@/lib/cn';

import { Skeleton } from './Skeleton';
import { useThumb } from './useThumb';

export type PillTab<T extends string> = { id: T; label: string };

export type PillTabsProps<T extends string> = {
  tabs: readonly PillTab<T>[];
  active: T;
  /** Absent while the list loads, when each pill holds a placeholder where its count goes. */
  counts?: Record<T, number>;
  onChange: (tab: T) => void;
  /** The tab list's accessible name. */
  label: string;
  className?: string;
};

/**
 * The pills that narrow a list to one group, each with how many it holds: "All (24)", "In Review
 * (5)"… over the applications (286:1269), "All Resumes (5)", "Tailored (2)"… over the resumes
 * (304:3097). They wrap rather than clip. The Resumes board draws its counts in a lighter ink;
 * both pages keep the Applications look (`toreview.md` §18). While the counts load, each holds a
 * small placeholder in their place.
 */
export function PillTabs<T extends string>({
  tabs,
  active,
  counts,
  onChange,
  label,
  className,
}: PillTabsProps<T>) {
  const [track, thumb] = useThumb(tabs.findIndex((t) => t.id === active));
  return (
    <div
      ref={track}
      role="tablist"
      aria-label={label}
      className={cn(
        'relative inline-flex min-w-0 max-w-full items-center gap-0.5 self-start overflow-x-auto rounded-full bg-surface-muted p-1 [scrollbar-width:none]',
        className,
      )}
    >
      <span
        aria-hidden
        style={thumb.style}
        className={cn(
          'pointer-events-none absolute left-0 top-0 rounded-full bg-surface-card shadow-raised',
          thumb.placed && 'transition-[translate,width,height] duration-base ease-spring',
          !thumb.visible && 'hidden',
        )}
      />
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-thumb-item
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative h-8 whitespace-nowrap rounded-full px-4 text-body-m font-semibold tabular-nums transition-colors duration-fast ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              selected ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary',
            )}
          >
            {/* The count's place is held while it loads, so the pills don't widen and rewrap
                when the numbers land (`toreview.md` §84). */}
            {counts ? (
              `${tab.label} (${counts[tab.id]})`
            ) : (
              <>
                {tab.label}
                <span aria-hidden>
                  {' ('}
                  <Skeleton as="span" className="inline-block h-3 w-[1.5ch] align-[-1px]" />
                  {')'}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
