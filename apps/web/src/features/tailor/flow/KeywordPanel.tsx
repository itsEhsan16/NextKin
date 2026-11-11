'use client';

import type { TailorComparison } from '@nextkin/shared/models';
import {
  bucketCounts,
  filterRows,
  keywordRowsOf,
  sortRows,
  type KeywordBucket,
  type KeywordSort,
  type KeywordTab,
} from '@nextkin/shared/tailor/keywordRows';
import { useMemo, useState } from 'react';

import { cn } from '@/lib/cn';
import { fieldBox } from '@/ui/fieldBox';
import { InfoCircle, SearchLg, SwitchVertical01 } from '@/ui/lineIcons';
import { pressable } from '@/ui/pressable';
import { textLink } from '@/ui/textLink';
import { UnderlineTabs } from '@/ui/UnderlineTabs';

import type { TailorChoices } from '../useTailorRun';
import { KeywordRail } from './KeywordRail';
import { KeywordRow, TickBox } from './KeywordRow';

const NEXT_SORT: Record<KeywordSort, KeywordSort> = {
  default: 'worth-desc',
  'worth-desc': 'worth-asc',
  'worth-asc': 'default',
};
const SORT_LABEL: Record<KeywordSort, string> = {
  default: 'Sorted: most important first',
  'worth-desc': 'Sorted: highest impact first',
  'worth-asc': 'Sorted: lowest impact first',
};
const IMPACT_BASIS =
  'Points out of 10 each keyword adds once one of your roles shows it, from your plan. Listed in Skills only, it adds half.';
const TAB_NAME: Record<KeywordTab, string> = { missing: 'Missing', optional: 'Optional' };

/**
 * "Choose keywords to add" (owner's mockup, 2026-11-11): what the job asks for that the resume
 * lacks, required ones under Missing and preferred or soft ones under Optional, filtered by
 * category and search, each with what it adds. Nothing starts ticked (toreview §114).
 */
export function KeywordPanel({
  comparison,
  choices,
}: {
  comparison: TailorComparison;
  choices: TailorChoices;
}) {
  const rows = useMemo(() => keywordRowsOf(comparison), [comparison]);
  const [tab, setTab] = useState<KeywordTab>(
    rows.some((r) => r.tab === 'missing') || rows.length === 0 ? 'missing' : 'optional',
  );
  const [bucket, setBucket] = useState<KeywordBucket | undefined>();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<KeywordSort>('default');

  const inTab = rows.filter((r) => r.tab === tab).length;
  const counts = bucketCounts(rows, tab);
  // A category the open tab doesn't hold falls back to All.
  const group = counts.some((c) => c.bucket === bucket) ? bucket : undefined;
  const shown = sortRows(filterRows(rows, { tab, bucket: group, query }), sort);
  const max = Math.max(0, ...rows.map((r) => r.worth ?? 0));
  const picks = comparison.picks;
  const places = comparison.places ?? [];
  const added = choices.added;
  const visible = shown.map((r) => r.label);
  const onCount = visible.filter((l) => added.includes(l)).length;
  const allOn = visible.length > 0 && onCount === visible.length;
  const selectVisible = (on: boolean) =>
    on
      ? choices.tickAll(
          visible.filter((l) => !added.includes(l)),
          picks,
        )
      : choices.setAdded(added.filter((l) => !visible.includes(l)));

  const tabs = (['missing', 'optional'] as const).map((id) => ({
    id,
    label: `${TAB_NAME[id]} keywords (${rows.filter((r) => r.tab === id).length})`,
  }));

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <UnderlineTabs tabs={tabs} active={tab} onChange={setTab} label="Keywords to add" />
        <label className="relative w-full @xl/main:w-72">
          <span className="sr-only">Search keywords</span>
          <SearchLg
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords…"
            className={cn(fieldBox, 'pl-10 pr-3.5 placeholder:text-text-tertiary')}
          />
        </label>
      </div>

      <div className="grid gap-4 @2xl/main:grid-cols-[16rem_minmax(0,1fr)]">
        <KeywordRail total={inTab} counts={counts} active={group} onChange={setBucket} />

        <div className="flex min-w-0 flex-col gap-3">
          <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-card">
            <div className="flex items-center gap-4 border-b border-border-subtle bg-neutral-50 px-4">
              <TickBox
                label={`Select every keyword shown (${visible.length})`}
                checked={allOn}
                mixed={onCount > 0 && !allOn}
                onChange={selectVisible}
              >
                <span className="text-body-l font-semibold text-text-primary">
                  {TAB_NAME[tab]} keywords ({shown.length})
                </span>
              </TickBox>
              <span className="flex items-center gap-1.5 text-body-m font-semibold text-text-primary">
                ATS impact
                <span title={IMPACT_BASIS} className="text-text-tertiary">
                  <InfoCircle aria-label={IMPACT_BASIS} className="size-4" />
                </span>
                <button
                  type="button"
                  aria-label={SORT_LABEL[sort]}
                  title={SORT_LABEL[sort]}
                  onClick={() => setSort((s) => NEXT_SORT[s])}
                  className={cn(
                    pressable,
                    'flex size-control-sm items-center justify-center rounded-md hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-brand-600',
                    sort === 'default' ? 'text-text-tertiary' : 'text-brand-600',
                  )}
                >
                  <SwitchVertical01 aria-hidden className="size-4" />
                </button>
              </span>
            </div>
            {shown.length > 0 ? (
              <ul aria-label={`${TAB_NAME[tab]} keywords`} className="max-h-112 overflow-y-auto">
                {shown.map((row) => {
                  const on = added.includes(row.label);
                  const place = choices.places[row.label];
                  return (
                    <KeywordRow
                      key={row.label}
                      row={row}
                      max={max}
                      checked={on}
                      onToggle={(next) => choices.tick(row.label, next, picks)}
                      places={places}
                      place={place}
                      showPlace={
                        row.bucket !== 'soft' &&
                        ((picks?.[row.label]?.length ?? 0) > 0 || place !== undefined)
                      }
                      onTogglePlace={(where, next) => choices.togglePlace(row.label, where, next)}
                      onClearPlaces={() => choices.clearPlaces(row.label)}
                    />
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-10 text-center text-body-m text-text-tertiary">
                {query.trim()
                  ? `No keyword matches “${query.trim()}”.`
                  : inTab === 0 && tab === 'missing'
                    ? 'Nothing missing. Your resume already has every keyword this job requires.'
                    : 'Nothing here.'}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border-subtle bg-surface-card px-4">
            <TickBox
              label={`Select all (${visible.length})`}
              className="flex-none"
              checked={allOn}
              mixed={onCount > 0 && !allOn}
              onChange={selectVisible}
            >
              <span className="text-body-m font-semibold text-text-primary">
                Select all ({visible.length})
              </span>
            </TickBox>
            <button
              type="button"
              disabled={added.length === 0}
              onClick={() => choices.setAdded([])}
              className={cn(
                textLink,
                'min-h-control-lg text-body-m text-text-secondary disabled:text-text-tertiary',
              )}
            >
              Clear selection
            </button>
            <span
              aria-live="polite"
              className="ml-auto text-body-m font-semibold text-text-primary"
            >
              {added.length} keyword{added.length === 1 ? '' : 's'} selected
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
