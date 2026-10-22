import { cn } from '@/lib/cn';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { ChevronDownIcon, GridViewIcon, ListViewIcon, SearchIcon } from '@/ui/icons';
import { outlineButton } from '@/ui/outlineButton';
import { chevronTurn, menuTrigger } from '@/ui/menuMotion';

import { DOCUMENT_SORT_OPTIONS, type DocumentSort, type DocumentView } from '../documentLibrary';
import { pressable } from '@/ui/pressable';

export type DocumentsToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  sort: DocumentSort;
  onSortChange: (sort: DocumentSort) => void;
  view: DocumentView;
  onViewChange: (view: DocumentView) => void;
};

const VIEWS = [
  { id: 'list', label: 'List view', Icon: ListViewIcon },
  { id: 'grid', label: 'Grid view', Icon: GridViewIcon },
] as const;

/**
 * The row over the pills (286:2068-2086): the library's search, its sort, and the list/grid
 * switch. The sort is the same order as "Sort by" under the pills, so either control moves both.
 */
export function DocumentsToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
  view,
  onViewChange,
}: DocumentsToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="flex h-control-lg w-64 min-w-0 items-center gap-2 rounded-md border border-border-divider bg-surface-card px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600">
        <SearchIcon className="size-4 shrink-0 text-neutral-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search documents..."
          aria-label="Search documents"
          className="min-w-0 flex-1 bg-transparent text-body-l text-text-primary outline-none placeholder:text-neutral-400"
        />
      </label>

      <FilterDropdown
        trigger={
          <button
            type="button"
            aria-label={`Sort documents: ${DOCUMENT_SORT_OPTIONS[sort]}`}
            className={cn(
              outlineButton,
              'h-control-lg shrink-0 gap-6 rounded-md px-3.5 text-body-l font-semibold text-neutral-700',
              menuTrigger,
            )}
          >
            {DOCUMENT_SORT_OPTIONS[sort]}
            <ChevronDownIcon className={cn('size-4 shrink-0', chevronTurn)} />
          </button>
        }
      >
        {(Object.entries(DOCUMENT_SORT_OPTIONS) as [DocumentSort, string][]).map(
          ([value, label]) => (
            <FilterCheckboxItem
              key={value}
              checked={sort === value}
              onCheckedChange={() => onSortChange(value)}
            >
              {label}
            </FilterCheckboxItem>
          ),
        )}
      </FilterDropdown>

      <div role="group" aria-label="Layout" className="flex shrink-0 gap-1.5">
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
                'flex size-control-md items-center justify-center rounded-sm border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
                active
                  ? 'border-brand-600 bg-brand-600 text-text-inverse'
                  : 'border-border-subtle bg-surface-card text-text-tertiary hover:bg-surface-muted',
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
