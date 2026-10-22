import { cn } from '@/lib/cn';

import { Skeleton } from './Skeleton';
import { pressable } from '@/ui/pressable';

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
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex flex-wrap items-center gap-1.5', className)}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              pressable,
              'h-control-sm whitespace-nowrap rounded-full border px-2.5 text-body-m font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              selected
                ? 'border-brand-600 bg-brand-600 text-text-inverse'
                : 'border-border-default bg-surface-card text-neutral-700 hover:bg-surface-muted',
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
