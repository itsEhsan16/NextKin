'use client';

import { SearchField } from '@/ui/SearchField';

export type ResumeSearchBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  className?: string;
};

/**
 * The library's search, over the list it narrows: the shared field (toreview §254). The sort lives
 * once, in "Sort by" over the list (redesign R6a, audit RS-06).
 */
export function ResumeSearchBar({ search, onSearchChange, className }: ResumeSearchBarProps) {
  return (
    <div className={className}>
      <SearchField
        value={search}
        onChange={onSearchChange}
        placeholder="Search resumes…"
        label="Search resumes"
        className="w-full"
      />
    </div>
  );
}
