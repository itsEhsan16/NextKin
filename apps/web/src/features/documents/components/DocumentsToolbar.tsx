import { cn } from '@/lib/cn';
import { GridViewIcon, ListViewIcon, SearchIcon } from '@/ui/icons';

import type { DocumentView } from '../documentLibrary';
import { pressable } from '@/ui/pressable';

export type DocumentsToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  view: DocumentView;
  onViewChange: (view: DocumentView) => void;
};

const VIEWS = [
  { id: 'list', label: 'List view', Icon: ListViewIcon },
  { id: 'grid', label: 'Grid view', Icon: GridViewIcon },
] as const;

/**
 * The row over the pills (286:2068-2086): the library's search and the list/grid switch. The
 * board also draws a sort here; "Sort by" under the pills is the one sort, as on Resumes and the
 * other lists (redesign R6d, audit DC-03).
 */
export function DocumentsToolbar({
  search,
  onSearchChange,
  view,
  onViewChange,
}: DocumentsToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex h-control-lg min-w-0 max-w-sm flex-1 items-center gap-2 rounded-full border border-border-default bg-surface-card px-4 shadow-card transition-field duration-fast ease-standard hover:border-border-strong focus-within:border-border-selected focus-within:ring-4 focus-within:ring-brand-100">
        <SearchIcon aria-hidden className="size-4 shrink-0 text-text-tertiary" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search documents…"
          aria-label="Search documents"
          className="min-w-0 flex-1 bg-transparent text-body-l text-text-primary outline-none placeholder:text-text-tertiary"
        />
      </label>

      <div
        role="group"
        aria-label="Layout"
        className="ml-auto flex shrink-0 gap-0.5 rounded-full bg-surface-muted p-1"
      >
        {VIEWS.map(({ id, label, Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={active}
              onClick={() => onViewChange(id)}
              className={cn(
                pressable,
                'flex h-control-sm w-11 items-center justify-center rounded-full transition-[color,background-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                active
                  ? 'bg-surface-card text-text-primary shadow-raised'
                  : 'text-text-tertiary hover:text-text-primary',
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
