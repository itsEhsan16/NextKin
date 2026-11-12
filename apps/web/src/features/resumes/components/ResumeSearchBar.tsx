'use client';

import { cn } from '@/lib/cn';
import { fieldBox } from '@/ui/fieldBox';
import { SearchIcon } from '@/ui/icons';
import { XClose } from '@/ui/lineIcons';

export type ResumeSearchBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  className?: string;
};

/**
 * The library's search, over the list it narrows (the board draws it in the detail panel,
 * 304:3246; the overhaul lifts it to the list's header so the panel is one card). The sort lives
 * once, in "Sort by" over the list (redesign R6a, audit RS-06: an icon here was a second control
 * for the same order). A filled field can be cleared in one press.
 */
export function ResumeSearchBar({ search, onSearchChange, className }: ResumeSearchBarProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <label
        className={cn(
          fieldBox,
          'flex-1 gap-2.5 px-3.5 focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100',
        )}
      >
        <SearchIcon className="size-4 shrink-0 text-text-tertiary" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search resumes..."
          aria-label="Search resumes"
          className="min-w-0 flex-1 bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear the search"
            className="-mr-1.5 flex size-7 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors duration-press ease-standard hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <XClose aria-hidden className="size-4" />
          </button>
        )}
      </label>
    </div>
  );
}
