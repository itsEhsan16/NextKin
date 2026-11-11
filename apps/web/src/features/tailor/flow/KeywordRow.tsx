'use client';

import type { TailorPlace } from '@nextkin/shared/models';
import { impactSegments, type KeywordRow as Row } from '@nextkin/shared/tailor/keywordRows';
import type { ReactNode } from 'react';

import { Check } from '@/features/create/jobFlow/FlowRows';
import { cn } from '@/lib/cn';
import { Tag } from '@/ui/Tag';

import type { KeywordPlace } from '../useTailorRun';
import { PlacePicker } from './PlacePicker';

const SEGMENTS = [0, 1, 2, 3, 4] as const;

/** Five segments filled in proportion to the most any keyword is worth; "—" when unpriced. */
export function ImpactMeter({ worth, max }: { worth: number | null; max: number }) {
  if (worth === null) {
    return (
      <span
        title="The score doesn’t measure this one, so it isn’t given a number."
        className="w-12 text-right text-body-m font-semibold text-text-tertiary"
      >
        —
      </span>
    );
  }
  const filled = impactSegments(worth, max);
  return (
    <span className="flex items-center gap-3">
      <span aria-hidden className="flex gap-0.5">
        {SEGMENTS.map((i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 w-4 rounded-full transition-colors duration-base ease-standard',
              i < filled ? 'bg-success-600' : 'bg-neutral-200',
            )}
          />
        ))}
      </span>
      <span className="w-12 text-right text-body-m font-semibold text-success-600">
        +{worth.toFixed(1)}
      </span>
    </span>
  );
}

/** A tick box drawn as the flow's `Check`, over a real checkbox, labelled by the keyword alone. */
export function TickBox({
  label,
  checked,
  mixed = false,
  onChange,
  className,
  children,
}: {
  label: string;
  className?: string;
  checked: boolean;
  mixed?: boolean;
  onChange: (on: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <label
      className={cn(
        'flex min-h-control-lg min-w-0 flex-1 cursor-pointer items-center gap-3.5',
        className,
      )}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = mixed;
        }}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span className="rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600">
        <Check on={checked} />
      </span>
      {children}
    </label>
  );
}

/**
 * One keyword of the table (owner's mockup, 2026-11-11): its tick, its name and category, and
 * what it adds once placed in a role. A ticked one the comparison found a place for shows where it
 * goes underneath, as Enhance did (toreview §163); one that fits nowhere is a skills-list tick.
 */
export function KeywordRow({
  row,
  max,
  checked,
  onToggle,
  places,
  place,
  showPlace,
  onTogglePlace,
  onClearPlaces,
}: {
  row: Row;
  max: number;
  checked: boolean;
  onToggle: (on: boolean) => void;
  places: readonly TailorPlace[];
  place: KeywordPlace | undefined;
  showPlace: boolean;
  onTogglePlace: (where: string, on: boolean) => void;
  onClearPlaces: () => void;
}) {
  return (
    <li className="border-b border-border-subtle px-4 transition-colors duration-fast ease-standard last:border-b-0 hover:bg-neutral-50">
      <div className="flex items-center gap-4">
        <TickBox label={row.label} checked={checked} onChange={onToggle}>
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <span
              title={row.quote}
              className="truncate text-body-l font-semibold text-text-primary"
            >
              {row.label}
            </span>
            {row.tag && (
              <Tag tone="brand" shape="pill">
                {row.tag}
              </Tag>
            )}
          </span>
        </TickBox>
        <ImpactMeter worth={row.worth} max={max} />
      </div>
      {checked && showPlace && (
        <div className="flex items-center gap-2 pb-3 pl-9">
          <span className="text-body-s font-medium text-text-tertiary">Goes in</span>
          <PlacePicker
            places={places}
            where={place?.where}
            by={place?.by}
            onToggle={onTogglePlace}
            onClear={onClearPlaces}
          />
        </div>
      )}
    </li>
  );
}
