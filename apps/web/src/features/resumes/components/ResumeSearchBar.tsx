'use client';

import type { ResumeSort } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { fieldBox } from '@/ui/fieldBox';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { SearchIcon, SortIcon } from '@/ui/icons';
import { outlineButton } from '@/ui/outlineButton';

import { RESUME_SORT_OPTIONS } from '../resumeLibrary';

export type ResumeSearchBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  sort: ResumeSort;
  onSortChange: (sort: ResumeSort) => void;
  className?: string;
};

/**
 * The library's search and its sort, over the list they narrow (the board draws them in the
 * detail panel, 304:3246; the overhaul lifts them to the list's header so the panel is one card).
 * The sort is the same order as "Sort by" over the list, as an icon action beside the field.
 */
export function ResumeSearchBar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  className,
}: ResumeSearchBarProps) {
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
          className="min-w-0 flex-1 bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary"
        />
      </label>

      <FilterDropdown
        align="end"
        trigger={
          <button
            type="button"
            aria-label={`Sort resumes: ${RESUME_SORT_OPTIONS[sort]}`}
            title={`Sort: ${RESUME_SORT_OPTIONS[sort]}`}
            className={cn(
              outlineButton,
              'size-control-lg shrink-0 rounded-md text-text-secondary hover:text-text-primary',
            )}
          >
            <SortIcon className="size-4" />
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
  );
}
