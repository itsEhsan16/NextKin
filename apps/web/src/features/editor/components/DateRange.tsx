'use client';

import type { ReactNode } from 'react';

import { MonthField } from '@/features/onboarding/components/MonthField';

/**
 * From and To for an entry (toreview §124), on onboarding's month picker. A To of "Present" is
 * stored as no end date, as the canonical resume has it; with no From there is no period at all.
 */
export function DateRange({
  start,
  end,
  onChange,
  presentLabel = true,
  labels = ['From', 'To'],
  before,
}: {
  start: string | null;
  end: string | null;
  onChange: (dates: { start: string | null; end: string | null }) => void;
  presentLabel?: boolean;
  /** The editor's role says Start and End (EDIT 01); onboarding and Zero say From and To. */
  labels?: readonly [string, string];
  /** A field in the same row ahead of the dates: a role's location. */
  before?: ReactNode;
}) {
  const shownEnd = end ?? (start ? 'present' : null);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap gap-3">
        {before}
        <MonthField
          label={labels[0]}
          value={start}
          onChange={(value) => onChange({ start: value, end: end && end < value ? null : end })}
        />
        <MonthField
          label={labels[1]}
          value={shownEnd}
          allowPresent={presentLabel}
          min={start}
          disabled={!start}
          onChange={(value) => onChange({ start, end: value === 'present' ? null : value })}
        />
      </div>
      {start && (
        <button
          type="button"
          onClick={() => onChange({ start: null, end: null })}
          className="self-start rounded-sm px-1 text-caption-m font-semibold text-text-tertiary transition-colors duration-press ease-standard hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          Clear dates
        </button>
      )}
    </div>
  );
}
