import type { ApplicationWithJob } from '@nextkin/shared/models';
import { EMPLOYMENT_TYPE_LABEL, REMOTE_TYPE_LABEL } from '@nextkin/shared/models';
import { useMemo } from 'react';

import { distinct, toggleItem as toggle } from '@/lib/arrays';
import { TIME_WINDOW_LABEL, type TimeWindow } from '@/lib/timeWindow';
import { FilterChip } from '@/ui/FilterChip';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { SlidersIcon } from '@/ui/icons';
import { ResetButton } from '@/ui/ResetButton';

import type { ApplicationFilters } from '../applicationFilters';

export type ApplicationFilterChipsRowProps = {
  filters: ApplicationFilters;
  onChange: (patch: Partial<ApplicationFilters>) => void;
  onReset: () => void;
  /**
   * Every application, unfiltered, so each menu offers what exists rather than what survives the
   * other filters.
   */
  rows: ApplicationWithJob[];
};

/**
 * "Time period", "Job type", "Company", "Location", "More filters" and "Reset" (286:1282). None
 * is drawn open, so each menu is a `FilterDropdown` like the Jobs row's, its options taken from
 * the applications themselves so that none leads nowhere.
 */
export function ApplicationFilterChipsRow({
  filters,
  onChange,
  onReset,
  rows,
}: ApplicationFilterChipsRowProps) {
  const types = useMemo(() => distinct(rows.map((row) => row.job.employmentType)), [rows]);
  const companies = useMemo(() => distinct(rows.map((row) => row.job.company)).sort(), [rows]);
  const locations = useMemo(() => distinct(rows.map((row) => row.job.location)).sort(), [rows]);
  const workplaces = useMemo(() => distinct(rows.map((row) => row.job.remote)), [rows]);

  return (
    // Holds one line down to a ~600px list column (a 1396px window) and wraps below that, like
    // the Jobs row, with Reset staying level with the first line.
    <div className="flex items-start gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterDropdown
          trigger={<FilterChip label="Time period" active={filters.appliedWithin != null} />}
        >
          {(Object.entries(TIME_WINDOW_LABEL) as [TimeWindow, string][]).map(([value, label]) => (
            <FilterCheckboxItem
              key={value}
              checked={filters.appliedWithin === value}
              onCheckedChange={() =>
                onChange({ appliedWithin: filters.appliedWithin === value ? undefined : value })
              }
            >
              {label}
            </FilterCheckboxItem>
          ))}
        </FilterDropdown>

        <FilterDropdown
          trigger={<FilterChip label="Job type" active={filters.employmentTypes.length > 0} />}
        >
          {types.map((value) => (
            <FilterCheckboxItem
              key={value}
              checked={filters.employmentTypes.includes(value)}
              onCheckedChange={() =>
                onChange({ employmentTypes: toggle(filters.employmentTypes, value) })
              }
            >
              {EMPLOYMENT_TYPE_LABEL[value]}
            </FilterCheckboxItem>
          ))}
        </FilterDropdown>

        <FilterDropdown
          trigger={<FilterChip label="Company" active={filters.companies.length > 0} />}
        >
          {companies.map((company) => (
            <FilterCheckboxItem
              key={company}
              checked={filters.companies.includes(company)}
              onCheckedChange={() => onChange({ companies: toggle(filters.companies, company) })}
            >
              {company}
            </FilterCheckboxItem>
          ))}
        </FilterDropdown>

        <FilterDropdown
          trigger={<FilterChip label="Location" active={filters.locations.length > 0} />}
        >
          {locations.map((location) => (
            <FilterCheckboxItem
              key={location}
              checked={filters.locations.includes(location)}
              onCheckedChange={() => onChange({ locations: toggle(filters.locations, location) })}
            >
              {location}
            </FilterCheckboxItem>
          ))}
        </FilterDropdown>

        <FilterDropdown
          trigger={
            <FilterChip
              label="More filters"
              active={filters.remote.length > 0}
              icon={<SlidersIcon className="size-3.5 shrink-0" />}
              chevron="none"
            />
          }
        >
          <p className="px-2 pb-1 pt-0.5 text-micro text-text-tertiary">Workplace</p>
          {workplaces.map((value) => (
            <FilterCheckboxItem
              key={value}
              checked={filters.remote.includes(value)}
              onCheckedChange={() => onChange({ remote: toggle(filters.remote, value) })}
            >
              {REMOTE_TYPE_LABEL[value]}
            </FilterCheckboxItem>
          ))}
        </FilterDropdown>
      </div>

      <ResetButton onClick={onReset} />
    </div>
  );
}
