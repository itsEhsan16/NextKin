'use client';

import { cn } from '@/lib/cn';
import { ChevronLeft, ChevronRight } from '@/ui/lineIcons';

const square =
  'flex size-9 items-center justify-center rounded-md border border-border-default bg-surface-card text-body-m font-semibold text-text-secondary transition-colors duration-press ease-standard hover:border-border-brand-strong hover:text-text-primary disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

/**
 * "Showing 4 of 12 jobs" with the pages beside it. `compact` is "‹ 1 / 3 ›"; `numbered` lists each
 * page, as the resume picker does. Nothing renders for a single page but the count.
 */
export function Pager({
  page,
  pages,
  onPage,
  shown,
  total,
  noun,
  variant = 'compact',
  label,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  shown: number;
  total: number;
  /** "jobs", "resumes". */
  noun: string;
  variant?: 'compact' | 'numbered';
  /** The pager's accessible name: "Saved job pages". */
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-body-m text-text-tertiary">
        Showing {shown} of {total} {noun}
      </p>
      {pages > 1 && (
        <nav aria-label={label} className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className={square}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          {variant === 'compact' ? (
            <span className="px-2 text-body-m font-semibold text-text-primary" aria-live="polite">
              <span className="text-text-brand">{page}</span> / {pages}
            </span>
          ) : (
            Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-current={n === page ? 'page' : undefined}
                onClick={() => onPage(n)}
                className={cn(square, n === page && 'border-brand-100 bg-brand-50 text-text-brand')}
              >
                {n}
              </button>
            ))
          )}
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
            className={square}
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </nav>
      )}
    </div>
  );
}

/** One page of a list, with the page kept in range when the list shrinks. */
export function pageOf<T>(items: readonly T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const at = Math.min(Math.max(1, page), pages);
  return { pages, page: at, items: items.slice((at - 1) * size, at * size) };
}
