import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';
import { fieldBox } from '@/ui/fieldBox';
import { SearchIcon } from '@/ui/icons';
import { XClose } from '@/ui/lineIcons';

export type JobsSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  /** Search pressed (or Enter): apply the words now rather than after the typing pause. */
  onSubmit?: () => void;
};

/**
 * The Jobs page's search (304:2397): the field and the Search button. Results follow the typing
 * after a short pause; Search and Enter apply it at once, and the × clears it (redesign R5a,
 * audit JB-09: Search used to do nothing).
 */
export function JobsSearchBar({ value, onChange, onSubmit }: JobsSearchBarProps) {
  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
      className="relative flex w-full items-center gap-3 lg:w-4/5"
    >
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-disabled" />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Job title, company, or keyword"
          aria-label="Search jobs"
          className={cn(
            fieldBox,
            'rounded-full pl-10 text-body-l shadow-card placeholder:text-text-disabled',
            value ? 'pr-10' : 'pr-4',
          )}
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onChange('');
              onSubmit?.();
            }}
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-text-tertiary transition-colors duration-press ease-standard hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
          >
            <XClose aria-hidden className="size-4" />
          </button>
        )}
      </div>
      <button type="submit" className={buttonClass({ size: 'lg', pill: true })}>
        Search
      </button>
    </form>
  );
}
