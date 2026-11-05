import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

export type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** The accessible name, when the placeholder alone wouldn't say what is searched. */
  label?: string;
  className?: string;
};

/**
 * The boards' search field (Figma 404:854): 42px, a slate outline, the glyph and the placeholder at
 * 14/22. It filters as it is typed; the caller debounces or defers the query.
 */
export function SearchField({ value, onChange, placeholder, label, className }: SearchFieldProps) {
  return (
    <label
      className={cn(
        'flex h-[42px] w-[340px] items-center gap-2 rounded-sm border border-neutral-300 bg-surface-card px-3 shadow-xs transition-[border-color,box-shadow] duration-fast ease-standard focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100',
        className,
      )}
    >
      <AdminIcon name="SearchLg" className="text-neutral-500" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        className="min-w-0 flex-1 bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary"
      />
    </label>
  );
}
