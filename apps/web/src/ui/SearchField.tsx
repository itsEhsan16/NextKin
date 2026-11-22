'use client';

import { cn } from '@/lib/cn';
import { SearchIcon } from '@/ui/icons';
import { XClose } from '@/ui/lineIcons';

export type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** The words in the empty field, ending in "…": "Search resumes…". */
  placeholder: string;
  /** The field's accessible name: "Search resumes". */
  label: string;
  /** After the × clears the field (Jobs re-runs its search at once). */
  onClear?: () => void;
  className?: string;
};

/**
 * The one search field of every list (owner, toreview §254: four pages drew four): a pill at the
 * large control height with the card shadow, the glass in the tertiary ink, body-l type, and a ×
 * that clears it in one press once there is something to clear. Width is the caller's; it fills
 * its row by default.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  onClear,
  className,
}: SearchFieldProps) {
  return (
    <label
      className={cn(
        'flex h-control-lg min-w-0 flex-1 items-center gap-2 rounded-full border border-border-default bg-surface-card pl-4 pr-2 shadow-card transition-field duration-fast ease-standard hover:border-border-strong focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100',
        className,
      )}
    >
      <SearchIcon aria-hidden className="size-4 shrink-0 text-text-tertiary" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-body-l text-text-primary outline-none placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:hidden"
      />
      {/* The ×'s place is kept while empty, so the text never shifts when it appears. */}
      <span className="flex size-7 shrink-0 items-center justify-center">
        {value && (
          <button
            type="button"
            aria-label="Clear the search"
            onClick={() => {
              onChange('');
              onClear?.();
            }}
            className="flex size-7 items-center justify-center rounded-full text-text-tertiary transition-colors duration-press ease-standard hover:bg-surface-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring"
          >
            <XClose aria-hidden className="size-4" />
          </button>
        )}
      </span>
    </label>
  );
}
