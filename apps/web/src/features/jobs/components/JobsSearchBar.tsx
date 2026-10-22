import { cn } from '@/lib/cn';
import { brandButton } from '@/ui/brandButton';
import { SearchIcon } from '@/ui/icons';

export type JobsSearchBarProps = { value: string; onChange: (value: string) => void };

/**
 * The page-level search field + "Search" button (304:2401/2407) — distinct from the header's
 * global search; this one filters the list below via `JobFilters.query`. It is 80% of the list
 * column, as on the board (534 of 660): the illustration's character stands in the space it
 * leaves. `relative` so it paints over the illustration's skyline, which sits behind it.
 *
 * Filtering is already live as the user types (the query is debounced, not gated on a click —
 * `JobsScreen` owns that), so the button's own submit does nothing beyond what typing already
 * triggers; it is still a real `<button type="submit">` inside a `<form>`, so it's a proper
 * keyboard target and Enter in the field behaves the way a search field's Enter key should.
 */
export function JobsSearchBar({ value, onChange }: JobsSearchBarProps) {
  return (
    <form
      role="search"
      onSubmit={(event) => event.preventDefault()}
      className="relative flex h-control-lg w-4/5 items-center gap-2 rounded-md border border-border-divider bg-surface-card p-[3px]"
    >
      <div className="flex flex-1 items-center gap-2 px-2.5">
        <SearchIcon className="size-4 shrink-0 text-neutral-400" />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Job title, company, or keyword"
          aria-label="Search jobs"
          className="w-full bg-transparent text-body-l text-text-primary placeholder:text-neutral-400 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className={cn(brandButton, 'h-full rounded-sm px-5 text-body-l font-semibold')}
      >
        Search
      </button>
    </form>
  );
}
