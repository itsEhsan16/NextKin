'use client';

import type { Resume, ResumeSort } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { SearchIcon, SortIcon } from '@/ui/icons';
import { outlineButton } from '@/ui/outlineButton';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { RESUME_SORT_OPTIONS } from '../resumeLibrary';
import { ResumeDetailCard } from './ResumeDetailCard';

export type ResumeDetailPanelProps = {
  resume?: Resume;
  /** `'empty'`: nothing to show — no document picked, or none at all (`hasAny`). */
  status: 'pending' | 'error' | 'success' | 'empty';
  hasAny: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  sort: ResumeSort;
  onSortChange: (sort: ResumeSort) => void;
  onRetry: () => void;
  onCreate?: () => void;
  className?: string;
};

/** The selected document's card, bordered inside the panel as drawn. */
const INNER = 'rounded-lg border border-border-card';

/**
 * The right column's panel (304:3246): the library's search and its sort, then the selected
 * document's card. The board puts the search here rather than over the list, so here it is; it
 * narrows the list beside it, and the sort button is the same order as "Sort by" over the list.
 *
 * Like the other pages' detail cards it keeps its natural height and scrolls as one unit only when
 * the window is shorter than it (`toreview.md` §16).
 */
export function ResumeDetailPanel({
  resume,
  status,
  hasAny,
  search,
  onSearchChange,
  sort,
  onSortChange,
  onRetry,
  onCreate,
  className,
}: ResumeDetailPanelProps) {
  const reveal = useReveal(status === 'success', resume?.id);
  return (
    <div
      className={cn(
        'min-h-0 overflow-y-auto rounded-lg border border-border-card bg-surface-card p-4 [scrollbar-width:thin]',
        className,
      )}
    >
      <div className="flex gap-3">
        <label className="flex h-control-lg min-w-0 flex-1 items-center gap-2 rounded-md border border-border-divider bg-surface-card px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600">
          <SearchIcon className="size-4 shrink-0 text-neutral-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search resumes..."
            aria-label="Search resumes"
            className="min-w-0 flex-1 bg-transparent text-body-l text-text-primary outline-none placeholder:text-neutral-400"
          />
        </label>

        <FilterDropdown
          align="end"
          trigger={
            <button
              type="button"
              aria-label={`Sort resumes: ${RESUME_SORT_OPTIONS[sort]}`}
              className={cn(
                outlineButton,
                'h-control-lg shrink-0 gap-2 rounded-md px-3.5 text-body-l font-semibold',
              )}
            >
              <SortIcon className="size-4 shrink-0 text-text-secondary" />
              {RESUME_SORT_OPTIONS[sort]}
            </button>
          }
        >
          {(Object.entries(RESUME_SORT_OPTIONS) as [ResumeSort, string][]).map(([value, label]) => (
            <FilterCheckboxItem
              key={value}
              checked={sort === value}
              onCheckedChange={() => onSortChange(value)}
            >
              {label}
            </FilterCheckboxItem>
          ))}
        </FilterDropdown>
      </div>

      <div className="mt-4">
        {status === 'empty' && (
          <div className={cn(INNER, 'p-5')}>
            {hasAny ? (
              <StateView
                title="Select a resume"
                message="Choose one from the list to preview it."
              />
            ) : (
              <StateView
                title="Nothing to preview yet"
                message="Create a resume and its preview will show here."
                {...(onCreate ? { actionLabel: 'Create a resume', onAction: onCreate } : {})}
              />
            )}
          </div>
        )}

        {status === 'pending' && (
          // As tall as the card that replaces it: the header, actions, tabs and the preview.
          <div className={cn(INNER, 'flex flex-col gap-3 p-4')}>
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-md" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-control-lg w-full rounded-md" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-112 w-full" />
          </div>
        )}

        {(status === 'error' || (status === 'success' && !resume)) && (
          <div className={cn(INNER, 'p-5')}>
            <StateView
              tone="danger"
              title="Couldn't load this resume"
              message="Check your connection and try again."
              actionLabel="Try again"
              onAction={onRetry}
            />
          </div>
        )}

        {status === 'success' && resume && (
          <ResumeDetailCard key={resume.id} resume={resume} reveal={reveal} />
        )}
      </div>
    </div>
  );
}
