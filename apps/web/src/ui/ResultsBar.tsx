import { FilterChip } from '@/ui/FilterChip';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { Skeleton } from '@/ui/Skeleton';

export type ResultsBarProps<S extends string> = {
  count?: number;
  loading: boolean;
  /** What is being counted: "result"/"results", "application"/"applications". */
  noun: { one: string; other: string };
  sort: S;
  sortOptions: Record<S, string>;
  onSortChange: (sort: S) => void;
  /** The trigger's text, when it says more than the current option ("Sort by: Most recent"). */
  sortLabel?: string;
};

/**
 * A list's count and its sort control: "124 results" and "Most relevant" on Jobs (304:2443-2446),
 * "24 applications" and "Sort by: Most recent" on Applications (304:2889).
 */
export function ResultsBar<S extends string>({
  count,
  loading,
  noun,
  sort,
  sortOptions,
  onSortChange,
  sortLabel,
}: ResultsBarProps<S>) {
  return (
    <div className="flex items-center justify-between pt-1">
      {loading || count == null ? (
        <Skeleton className="h-5 w-24" />
      ) : (
        <p className="text-body-l font-bold text-neutral-800">
          {count} {count === 1 ? noun.one : noun.other}
        </p>
      )}

      <FilterDropdown
        align="end"
        trigger={<FilterChip label={sortLabel ?? sortOptions[sort]} active={false} />}
      >
        {(Object.entries(sortOptions) as [S, string][]).map(([value, label]) => (
          <FilterCheckboxItem
            key={value}
            checked={sort === value}
            onCheckedChange={() => onSortChange(value)}
          >
            {label}
          </FilterCheckboxItem>
        ))}
      </FilterDropdown>
    </div>
  );
}
