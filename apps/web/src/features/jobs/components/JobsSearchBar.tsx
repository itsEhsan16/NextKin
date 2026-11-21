import { buttonClass } from '@/ui/Button';
import { SearchField } from '@/ui/SearchField';

export type JobsSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  /** Search pressed (or Enter): apply the words now rather than after the typing pause. */
  onSubmit?: () => void;
};

/**
 * The Jobs page's search (304:2397): the shared field (toreview §254) and the Search button, the
 * one list whose search looks for new jobs rather than narrowing a saved list. Results follow the
 * typing after a short pause; Search and Enter apply it at once, and the × clears it (redesign
 * R5a, audit JB-09).
 */
export function JobsSearchBar({ value, onChange, onSubmit }: JobsSearchBarProps) {
  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
      className="flex w-full items-center gap-3"
    >
      <SearchField
        value={value}
        onChange={onChange}
        onClear={onSubmit}
        placeholder="Job title, company, or keyword…"
        label="Search jobs"
      />
      <button type="submit" className={buttonClass({ size: 'lg', pill: true })}>
        Search
      </button>
    </form>
  );
}
