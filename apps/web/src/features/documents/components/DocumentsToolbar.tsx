import { cn } from '@/lib/cn';
import { GridViewIcon, ListViewIcon } from '@/ui/icons';
import { SearchField } from '@/ui/SearchField';

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
 * The row over the pills (286:2068-2086): the library's search, running up to the list/grid
 * switch with no empty stretch between them (owner, toreview §253), and the switch. The
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
      <SearchField
        value={search}
        onChange={onSearchChange}
        placeholder="Search documents…"
        label="Search documents"
      />

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
