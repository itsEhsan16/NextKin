'use client';

import type { TailorPlace } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { ChevronDownIcon } from '@/ui/icons';

export type PlacedBy = 'ai' | 'you';

/**
 * "AI places it in: Full-Stack Developer · Webcros" (owner, toreview §129): the role a skill is said
 * at — the AI's pick by default, any role or project the user picks instead, or Skills only.
 */
export function PlacePicker({
  places,
  where,
  by,
  onPlace,
}: {
  places: readonly TailorPlace[];
  where: string | undefined;
  by: PlacedBy | undefined;
  onPlace: (where: string | null) => void;
}) {
  const place = places.find((p) => p.id === where);
  const label = place
    ? `${by === 'ai' ? 'AI places it in' : 'Used in'}: ${place.label}`
    : 'Skills only';
  return (
    <FilterDropdown
      align="end"
      trigger={
        <button
          type="button"
          className={cn(
            'flex max-w-64 items-center gap-2 rounded-md border bg-surface-card px-3 py-1.5 text-body-m font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            place
              ? 'border-border-brand-strong text-brand-700'
              : 'border-border-default text-text-secondary',
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDownIcon aria-hidden className="size-3 shrink-0 text-text-tertiary" />
        </button>
      }
    >
      {places.map((p) => (
        <FilterCheckboxItem
          key={p.id}
          checked={p.id === where}
          closeOnSelect
          onCheckedChange={(on) => onPlace(on ? p.id : null)}
        >
          {p.label}
        </FilterCheckboxItem>
      ))}
      <FilterCheckboxItem checked={!place} closeOnSelect onCheckedChange={() => onPlace(null)}>
        Skills only (counts half)
      </FilterCheckboxItem>
    </FilterDropdown>
  );
}
