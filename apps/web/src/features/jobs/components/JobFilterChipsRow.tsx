import type {
  EmploymentType,
  ExperienceLevel,
  Job,
  JobFilters,
  PostedWithin,
} from '@nextkin/shared/models';
import {
  EMPLOYMENT_TYPE_LABEL,
  EXPERIENCE_LEVEL_LABEL,
  POSTED_WITHIN_LABEL,
  SALARY_FILTER_MAX,
  SALARY_FILTER_MIN,
  SALARY_FILTER_STEP,
} from '@nextkin/shared/models';
import { useMemo } from 'react';

import { FilterChip } from '@/ui/FilterChip';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { SlidersIcon } from '@/ui/icons';

export type JobFilterChipsRowProps = {
  filters: JobFilters;
  onChange: (patch: Partial<JobFilters>) => void;
  /**
   * The *unfiltered* catalogue, for deriving Location/Company option lists — narrowing this to
   * `jobs` (the currently-filtered result) would shrink each dropdown's own options as filters
   * apply, which is backwards.
   */
  allJobs: Job[];
};

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/**
 * The six filter chip triggers (304:2410-2435) — no open state is drawn for any of them, so each
 * dropdown's contents are built from existing primitives and the labels the shared model already
 * defines, not transcribed from Figma. The board draws six independent pills, not one combined
 * panel, so each opens its own `FilterDropdown` rather than one "all filters" sheet.
 */
export function JobFilterChipsRow({ filters, onChange, allJobs }: JobFilterChipsRowProps) {
  const locations = useMemo(
    () => Array.from(new Set(allJobs.map((job) => job.location))).sort(),
    [allJobs],
  );
  const companies = useMemo(
    () => Array.from(new Set(allJobs.map((job) => job.company))).sort(),
    [allJobs],
  );

  return (
    // Tight enough (8px chip padding, 6px apart) that the six chips hold one line down to a
    // ~600px list column — a 1396px-wide window; below that they wrap rather than clip.
    <div className="flex flex-wrap items-center gap-1.5">
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
        trigger={<FilterChip label="Job type" active={filters.employmentTypes.length > 0} />}
      >
        {(Object.entries(EMPLOYMENT_TYPE_LABEL) as [EmploymentType, string][]).map(
          ([value, label]) => (
            <FilterCheckboxItem
              key={value}
              checked={filters.employmentTypes.includes(value)}
              onCheckedChange={() =>
                onChange({ employmentTypes: toggle(filters.employmentTypes, value) })
              }
            >
              {label}
            </FilterCheckboxItem>
          ),
        )}
      </FilterDropdown>

      <FilterDropdown
        trigger={<FilterChip label="Experience" active={filters.experienceLevels.length > 0} />}
      >
        {(Object.entries(EXPERIENCE_LEVEL_LABEL) as [ExperienceLevel, string][]).map(
          ([value, label]) => (
            <FilterCheckboxItem
              key={value}
              checked={filters.experienceLevels.includes(value)}
              onCheckedChange={() =>
                onChange({ experienceLevels: toggle(filters.experienceLevels, value) })
              }
            >
              {label}
            </FilterCheckboxItem>
          ),
        )}
      </FilterDropdown>

      <FilterDropdown
        trigger={
          <FilterChip
            label="Salary"
            active={filters.salaryMin != null || filters.salaryMax != null}
          />
        }
      >
        <div className="flex w-64 flex-col gap-3 p-2">
          <label className="flex flex-col gap-1 text-caption-m text-text-secondary">
            Minimum — ₹{((filters.salaryMin ?? SALARY_FILTER_MIN) / 100_000).toFixed(0)}L/yr
            <input
              type="range"
              min={SALARY_FILTER_MIN}
              max={SALARY_FILTER_MAX}
              step={SALARY_FILTER_STEP}
              value={filters.salaryMin ?? SALARY_FILTER_MIN}
              onChange={(event) => onChange({ salaryMin: Number(event.target.value) })}
              className="accent-brand-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-caption-m text-text-secondary">
            Maximum — ₹{((filters.salaryMax ?? SALARY_FILTER_MAX) / 100_000).toFixed(0)}L/yr
            <input
              type="range"
              min={SALARY_FILTER_MIN}
              max={SALARY_FILTER_MAX}
              step={SALARY_FILTER_STEP}
              value={filters.salaryMax ?? SALARY_FILTER_MAX}
              onChange={(event) => onChange({ salaryMax: Number(event.target.value) })}
              className="accent-brand-600"
            />
          </label>
        </div>
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
        trigger={
          <FilterChip
            label="More filters"
            active={filters.postedWithin != null}
            icon={<SlidersIcon className="size-3.5 shrink-0" />}
            chevron="outside"
          />
        }
      >
        {(Object.entries(POSTED_WITHIN_LABEL) as [PostedWithin, string][]).map(([value, label]) => (
          <FilterCheckboxItem
            key={value}
            checked={filters.postedWithin === value}
            onCheckedChange={() =>
              onChange({ postedWithin: filters.postedWithin === value ? undefined : value })
            }
          >
            {label}
          </FilterCheckboxItem>
        ))}
      </FilterDropdown>
    </div>
  );
}
