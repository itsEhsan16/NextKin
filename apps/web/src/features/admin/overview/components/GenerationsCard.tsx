'use client';

import { useState } from 'react';

import {
  ADMIN_GENERATION_KIND_LABEL,
  ADMIN_GENERATION_KINDS,
  type AdminGenerationKind,
  type AdminGenerations,
  type AdminRange,
} from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { KIND_FILL, StackedBarChart } from '../../charts/StackedBarChart';
import { formatCount, formatRate, RANGE_DAYS } from '../../format';
import { DeltaBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { ButtonGroup } from '../../ui/ButtonGroup';

type KindChoice = AdminGenerationKind | 'all';

const CHOICES: { id: KindChoice; label: string }[] = [
  { id: 'all', label: 'All kinds' },
  ...ADMIN_GENERATION_KINDS.map((kind) => ({ id: kind, label: ADMIN_GENERATION_KIND_LABEL[kind] })),
];

/**
 * AI runs in the window (Figma 395:596): the total and its change, how many failed, the p95 run
 * time, and the last fortnight per day. The kind switch narrows the total, the failures and the
 * chart to one kind.
 */
export function GenerationsCard({
  generations,
  range,
}: {
  generations: AdminGenerations | null;
  range: AdminRange;
}) {
  const [kind, setKind] = useState<KindChoice>('all');

  return (
    <AdminCard
      icon="BarChart10"
      title="AI generations"
      trailing={
        <ButtonGroup label="Generation kind" options={CHOICES} value={kind} onChange={setKind} />
      }
      bodyClassName="gap-4"
    >
      {generations ? (
        <Body generations={generations} kind={kind} range={range} />
      ) : (
        <NotConnected what="AI runs" />
      )}
    </AdminCard>
  );
}

function Body({
  generations,
  kind,
  range,
}: {
  generations: AdminGenerations;
  kind: KindChoice;
  range: AdminRange;
}) {
  const kinds = kind === 'all' ? ADMIN_GENERATION_KINDS : [kind];
  const runs = kinds.reduce((sum, k) => sum + generations.totals[k].runs, 0);
  const failed = kinds.reduce((sum, k) => sum + generations.totals[k].failed, 0);
  // The p95 is measured across every kind, so it shows only while every kind does; a window with
  // no runs has no change and no run time to report.
  const facts = [
    `${formatCount(failed)} failed (${formatRate(runs ? failed / runs : 0)})`,
    kind === 'all' &&
      runs > 0 &&
      generations.p95Seconds !== null &&
      `p95 run time ${generations.p95Seconds}s`,
  ].filter(Boolean);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <p
              key={kind}
              className="animate-reveal text-display-l font-semibold tracking-display text-text-primary"
            >
              {formatCount(runs)}
            </p>
            {generations.delta && kind === 'all' && runs > 0 && (
              <>
                <DeltaBadge delta={generations.delta} />
                <span className="text-body-s font-medium text-text-secondary">
                  vs previous {RANGE_DAYS[range]} days
                </span>
              </>
            )}
          </div>
          <p className="text-body-s text-text-tertiary">{facts.join(' · ')}</p>
        </div>

        <ul aria-label="Legend" className="flex flex-wrap items-center gap-4">
          {ADMIN_GENERATION_KINDS.map((k) => (
            <li
              key={k}
              className={cn(
                'flex items-center gap-1.5 text-body-s text-text-secondary transition-opacity duration-base ease-standard',
                !kinds.includes(k) && 'opacity-40',
              )}
            >
              <span aria-hidden className={cn('size-2 rounded-full', KIND_FILL[k])} />
              {ADMIN_GENERATION_KIND_LABEL[k]}
            </li>
          ))}
        </ul>
      </div>

      {generations.days.length > 0 ? (
        <StackedBarChart days={generations.days} kind={kind} />
      ) : runs === 0 ? (
        <CardEmpty
          title="No runs yet"
          message="Runs show here per day once people start generating."
        />
      ) : (
        <NotConnected what="runs per day" />
      )}
    </>
  );
}
