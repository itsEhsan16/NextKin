'use client';

import { KEYWORD_BUCKET_LABEL, type KeywordBucket } from '@nextkin/shared/tailor/keywordRows';

import { FilterChip } from '@/ui/FilterChip';

/**
 * The kinds of keyword above the table: All, then each kind the open list holds, with its count.
 * A kind with none is left out. A row of chips since the score rail took the side (owner,
 * 2026-11-14); it was a column of its own.
 */
export function KeywordRail({
  total,
  counts,
  active,
  onChange,
}: {
  total: number;
  counts: readonly { bucket: KeywordBucket; count: number }[];
  active: KeywordBucket | undefined;
  onChange: (bucket: KeywordBucket | undefined) => void;
}) {
  const items = [
    { id: undefined, label: 'All', count: total },
    ...counts.map((c) => ({ id: c.bucket, label: KEYWORD_BUCKET_LABEL[c.bucket], count: c.count })),
  ];
  // One kind only says nothing "All" doesn't.
  if (items.length <= 2) return null;
  return (
    <div role="group" aria-label="Keyword kinds" className="flex min-w-0 flex-wrap gap-2">
      {items.map((item) => (
        <FilterChip
          key={item.label}
          label={`${item.label} ${item.count}`}
          active={item.id === active}
          chevron="none"
          aria-pressed={item.id === active}
          onClick={() => onChange(item.id)}
        />
      ))}
    </div>
  );
}
