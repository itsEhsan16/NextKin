import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';
import { fieldBox } from '@/ui/fieldBox';
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
      className="relative flex w-4/5 items-center gap-3"
    >
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Job title, company, or keyword"
          aria-label="Search jobs"
          className={cn(
            fieldBox,
            'rounded-full pl-10 pr-4 text-body-l shadow-card placeholder:text-neutral-400',
          )}
        />
      </div>
      <button type="submit" className={buttonClass({ size: 'lg', pill: true })}>
        Search
      </button>
    </form>
  );
}
