'use client';

import type { TailorPlace } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { ChevronDownIcon } from '@/ui/icons';

export type PlacedBy = 'ai' | 'you';

/** "Ease Home…", "Ease Home… +1": the first place, and how many more. */
function namesOf(chosen: readonly TailorPlace[]): string {
  const [first, ...rest] = chosen;
  return rest.length ? `${first!.label} +${rest.length}` : first!.label;
}

/**
 * Where a ticked skill goes (owner, toreview §163): the places picked from the resume's own lines,
 * shown as the AI's until the user changes them, any others they switch on, or Skills only. Several
 * may be on: the menu stays open while they choose.
 */
export function PlacePicker({
  places,
  where,
  by,
  emptyLabel = 'Skills only',
  onToggle,
  onClear,
}: {
  places: readonly TailorPlace[];
  where: readonly string[] | undefined;
  by: PlacedBy | undefined;
  /** The trigger's text with no place chosen. */
  emptyLabel?: string;
  onToggle: (where: string, on: boolean) => void;
  onClear: () => void;
}) {
  const chosen = places.filter((p) => where?.includes(p.id));
  const label = chosen.length
    ? `${by === 'ai' ? 'AI adds it to' : 'Used in'}: ${namesOf(chosen)}`
    : emptyLabel;
  return (
    <FilterDropdown
      align="end"
      trigger={
        <button
          type="button"
          title={chosen.map((p) => p.label).join(', ') || undefined}
          className={cn(
            'flex min-w-0 max-w-[60%] items-center gap-2 rounded-md border bg-surface-card px-3 py-1.5 text-body-m font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            chosen.length
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
          checked={chosen.some((c) => c.id === p.id)}
          onCheckedChange={(on) => onToggle(p.id, on)}
        >
          {p.label}
        </FilterCheckboxItem>
      ))}
      <FilterCheckboxItem checked={chosen.length === 0} closeOnSelect onCheckedChange={onClear}>
        Skills only (counts half)
      </FilterCheckboxItem>
    </FilterDropdown>
  );
}
