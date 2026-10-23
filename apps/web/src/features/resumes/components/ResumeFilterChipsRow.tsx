import type { Resume } from '@nextkin/shared/models';
import { useMemo } from 'react';

import { distinct, toggleItem } from '@/lib/arrays';
import { TIME_WINDOW_LABEL, type TimeWindow } from '@/lib/timeWindow';
import { FilterChip } from '@/ui/FilterChip';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { ResetButton } from '@/ui/ResetButton';

import type { ResumeFilters } from '../resumeFilters';
import { STATE_LABEL, STATES, stateOf, VARIANT_LABEL, VARIANTS } from '../resumeLibrary';

export type ResumeFilterChipsRowProps = {
  filters: ResumeFilters;
  onChange: (patch: Partial<ResumeFilters>) => void;
  onReset: () => void;
  /** The whole library, unfiltered, so each menu offers what exists rather than what is left. */
  resumes: Resume[];
};

/**
 * "Resume type", "Last updated", "Target role", "Status" and "Reset" (304:3108). None is drawn
 * open, so each is a `FilterDropdown` like the other lists' chips, offering only what the library
 * holds so that no option leads nowhere.
 */
export function ResumeFilterChipsRow({
  filters,
  onChange,
  onReset,
  resumes,
}: ResumeFilterChipsRowProps) {
  const variants = useMemo(
    () => VARIANTS.filter((variant) => resumes.some((resume) => resume.variant === variant)),
    [resumes],
  );
  const roles = useMemo(
    () => distinct(resumes.flatMap((resume) => resume.targetRole ?? [])).sort(),
    [resumes],
  );
  const states = useMemo(
    () => STATES.filter((state) => resumes.some((resume) => stateOf(resume) === state)),
    [resumes],
  );

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterDropdown
          trigger={<FilterChip label="Resume type" active={filters.variants.length > 0} />}
        >
          {variants.map((variant) => (
            <FilterCheckboxItem
              key={variant}
              checked={filters.variants.includes(variant)}
              onCheckedChange={() => onChange({ variants: toggleItem(filters.variants, variant) })}
            >
              {VARIANT_LABEL[variant]}
            </FilterCheckboxItem>
          ))}
        </FilterDropdown>

        <FilterDropdown
          trigger={<FilterChip label="Last updated" active={filters.updatedWithin != null} />}
        >
          {(Object.entries(TIME_WINDOW_LABEL) as [TimeWindow, string][]).map(([value, label]) => (
            <FilterCheckboxItem
              key={value}
              checked={filters.updatedWithin === value}
              onCheckedChange={() =>
                onChange({ updatedWithin: filters.updatedWithin === value ? undefined : value })
              }
            >
              {label}
            </FilterCheckboxItem>
          ))}
        </FilterDropdown>

        <FilterDropdown
          trigger={<FilterChip label="Target role" active={filters.roles.length > 0} />}
        >
          {roles.map((role) => (
            <FilterCheckboxItem
              key={role}
              checked={filters.roles.includes(role)}
              onCheckedChange={() => onChange({ roles: toggleItem(filters.roles, role) })}
            >
              {role}
            </FilterCheckboxItem>
          ))}
        </FilterDropdown>

        <FilterDropdown trigger={<FilterChip label="Status" active={filters.states.length > 0} />}>
          {states.map((state) => (
            <FilterCheckboxItem
              key={state}
              checked={filters.states.includes(state)}
              onCheckedChange={() => onChange({ states: toggleItem(filters.states, state) })}
            >
              {STATE_LABEL[state]}
            </FilterCheckboxItem>
          ))}
        </FilterDropdown>
      </div>

      <ResetButton onClick={onReset} />
    </div>
  );
}
