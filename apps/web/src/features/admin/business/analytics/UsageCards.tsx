'use client';

import type { AnalyticsGenerations, AnalyticsQuota } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { useChartFocus } from '../../charts/useChartFocus';
import { formatCount, formatRate } from '../../format';
import { AdminBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';
import { Track } from '../ui/BusinessParts';

/**
 * AI runs by kind (Figma 408:1229): each kind's count and share as a bar, then the runs per active
 * user, the failures and the p95 run time. Pointing at a kind fades the others.
 */
export function GenerationsByKindCard({
  generations,
}: {
  generations: AnalyticsGenerations | null;
}) {
  const { active, bind } = useChartFocus<string>();
  return (
    <AdminCard
      icon="Stars02"
      title="Generations by kind"
      trailing={
        generations && generations.total > 0 ? (
          <AdminBadge tone="neutral">{formatCount(generations.total)} total</AdminBadge>
        ) : undefined
      }
      bodyClassName="gap-5"
    >
      {!generations ? (
        <NotConnected what="runs by kind" />
      ) : generations.total === 0 ? (
        <CardEmpty
          title="No runs in this window"
          message="Runs show here by kind once people generate."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {generations.rows.map((row) => {
              const share = row.count / generations.total;
              return (
                <li
                  key={row.kind}
                  tabIndex={0}
                  aria-label={`${row.label}: ${formatCount(row.count)} runs, ${formatRate(share, 0)}`}
                  {...bind(row.kind)}
                  className={cn(
                    'flex cursor-default flex-col gap-2 rounded-sm outline-none transition-opacity duration-fast ease-standard focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2',
                    active !== null && active !== row.kind && 'opacity-40',
                  )}
                >
                  <div className="flex items-center gap-2 text-body-s">
                    <span className="min-w-0 flex-1 truncate font-medium text-neutral-700">
                      {row.label}
                    </span>
                    <span className="font-semibold tabular-nums text-text-primary">
                      {formatCount(row.count)}
                    </span>
                    <span className="min-w-8 text-right text-body-s font-normal text-text-tertiary">
                      {formatRate(share, 0)}
                    </span>
                  </div>
                  {/* The longest kind reaches the full width, as the board draws Tailor. */}
                  <Track
                    share={row.count / Math.max(...generations.rows.map((r) => r.count))}
                    fill="bg-brand-600"
                  />
                </li>
              );
            })}
          </ul>
          <dl className="mt-auto flex gap-4 border-t border-neutral-100 pt-4">
            <Fact label="Per active user" value={generations.perActiveUser?.toFixed(2) ?? '—'} />
            <Fact
              label="Failed"
              value={
                generations.failed === null
                  ? '—'
                  : `${formatCount(generations.failed)} · ${generations.failedRate === null ? '—' : formatRate(generations.failedRate)}`
              }
            />
            <Fact
              label="p95 run time"
              value={generations.p95Seconds === null ? '—' : `${generations.p95Seconds} s`}
            />
          </dl>
        </>
      )}
    </AdminCard>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <dt className="text-caption-m font-normal text-text-tertiary">{label}</dt>
      <dd className="text-body-s font-semibold tabular-nums text-text-primary">{value}</dd>
    </div>
  );
}

/** The scale the board draws the quota meters on: 20% at cap fills the track. */
const QUOTA_SCALE = 0.2;
/** One Free user in ten at a cap turns a meter amber. */
const QUOTA_WARN = 0.1;

/**
 * How often Free users hit a cap (Figma 408:1245): the share who reached at least one this month,
 * then each cap's share on a scale where 20% fills the bar. Amber marks a cap one in ten reach.
 */
export function QuotaConsumptionCard({ quota }: { quota: AnalyticsQuota | null }) {
  const { active, bind } = useChartFocus<string>();
  return (
    <AdminCard
      icon="PieChart03"
      title="Quota consumption"
      trailing={quota ? <AdminBadge tone="neutral">{quota.planLabel}</AdminBadge> : undefined}
      bodyClassName="gap-4"
    >
      {!quota ? (
        <NotConnected what="how often users reach a cap" />
      ) : quota.rows.length === 0 ? (
        <CardEmpty
          title="No quota use in this window"
          message="Caps show here once Free users start running into them."
        />
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <p className="animate-reveal text-display-l font-semibold tracking-display text-text-primary">
                {formatRate(quota.atCapShare)}
              </p>
              {quota.deltaPoints !== null && (
                // More Free users at a cap is the direction to watch, so a rise is amber.
                <AdminBadge
                  tone={quota.deltaPoints > 0 ? 'warning' : 'success'}
                  icon={
                    <AdminIcon name={quota.deltaPoints > 0 ? 'ArrowUp' : 'ArrowDown'} size="xs" />
                  }
                >
                  <span className="sr-only">{quota.deltaPoints > 0 ? 'Up ' : 'Down '}</span>
                  {Math.abs(quota.deltaPoints)} pts
                </AdminBadge>
              )}
            </div>
            <p className="text-body-s text-text-secondary">
              of Free users reached at least one cap this month
            </p>
          </div>
          <ul className="flex flex-col gap-3.5 border-t border-neutral-100 pt-4">
            {quota.rows.map((row) => (
              <li
                key={row.key}
                tabIndex={0}
                aria-label={`${row.label}, ${row.cap}: ${formatRate(row.atCapShare)} of Free users at the cap`}
                {...bind(row.key)}
                className={cn(
                  'flex cursor-default flex-col gap-2 rounded-sm outline-none transition-opacity duration-fast ease-standard focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2',
                  active !== null && active !== row.key && 'opacity-40',
                )}
              >
                <div className="flex items-center gap-2 text-body-s">
                  <span className="font-medium text-neutral-700">{row.label}</span>
                  <span className="min-w-0 flex-1 truncate text-caption-m font-normal text-text-tertiary">
                    {row.cap}
                  </span>
                  <span className="font-semibold tabular-nums text-text-primary">
                    {formatRate(row.atCapShare)} at cap
                  </span>
                </div>
                <Track
                  share={row.atCapShare / QUOTA_SCALE}
                  fill={row.atCapShare >= QUOTA_WARN ? 'bg-warning-600' : 'bg-brand-600'}
                />
              </li>
            ))}
          </ul>
          <p className="mt-auto text-caption-m font-normal text-text-tertiary">
            Bars scaled to 20%. Amber marks meters where one in ten Free users or more hit the cap.
          </p>
        </>
      )}
    </AdminCard>
  );
}
