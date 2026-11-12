import type { Resume } from '@nextkin/shared/models';
import { useMemo } from 'react';

import { distinct, toggleItem } from '@/lib/arrays';
import { TIME_WINDOW_LABEL, type TimeWindow } from '@/lib/timeWindow';
import { FilterChip } from '@/ui/FilterChip';
import { FilterCheckboxItem, FilterDropdown, FilterRadioGroup } from '@/ui/FilterDropdown';
import { ResetButton } from '@/ui/ResetButton';

import type { ResumeFilters } from '../resumeFilters';
import { STATE_LABEL, STATES, stateOf, VARIANT_LABEL, VARIANTS } from '../resumeLibrary';

export type ResumeFilterChipsRowProps = {
  filters: ResumeFilters;
  onChange: (patch: Partial<ResumeFilters>) => void;
  onReset: () => void;
  /** A chip or the search narrows the list: only then is there anything to clear (RS-07). */
  active: boolean;
  /** The whole library, unfiltered, so each menu offers what exists rather than what is left. */
  resumes: Resume[];
};

const WINDOWS = [
  ['any', 'Any time'],
  ...(Object.entries(TIME_WINDOW_LABEL) as [TimeWindow, string][]),
] as const;

/**
 * A chip whose menu would open empty is off, and says why (redesign R6a, audit RS-09).
 */
const unavailable = (options: number, why: string) =>
  options === 0
    ? { disabled: true, title: why, className: 'disabled:cursor-default disabled:opacity-60' }
    : {};

/**
 * "Resume type", "Last updated", "Target role", "Status" and "Reset" (304:3108). None is drawn
 * open, so each is a `FilterDropdown` like the other lists' chips, offering only what the library
 * holds so that no option leads nowhere.
 */
export function ResumeFilterChipsRow({
  filters,
  onChange,
  onReset,
  active,
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
          trigger={
            <FilterChip
              label="Resume type"
              active={filters.variants.length > 0}
              {...unavailable(variants.length, 'No resume has a type yet')}
            />
          }
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
          {/* One window at a time, so radio rows (RS-08); "Any time" is the way back. */}
          <FilterRadioGroup
            value={filters.updatedWithin ?? 'any'}
            onValueChange={(value) =>
              onChange({ updatedWithin: value === 'any' ? undefined : (value as TimeWindow) })
            }
            options={WINDOWS}
          />
        </FilterDropdown>

        <FilterDropdown
          trigger={
            <FilterChip
              label="Target role"
              active={filters.roles.length > 0}
              {...unavailable(roles.length, 'No resume has a target role yet')}
            />
          }
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

        <FilterDropdown
          trigger={
            <FilterChip
              label="Status"
              active={filters.states.length > 0}
              {...unavailable(
                states.length,
                'No resume is a draft, archived or format-checked yet',
              )}
            />
          }
        >
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

      {active && <ResetButton onClick={onReset} label="Clear filters" />}
    </div>
  );
}
