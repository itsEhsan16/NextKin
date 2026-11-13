'use client';

import { useState } from 'react';

import type { AdminAnalyticsPage, AnalyticsRange } from '@nextkin/shared/models';
import { useAdminAnalytics } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { StateView } from '@/ui/StateView';
import { Skeleton } from '@/ui/Skeleton';

import { downloadCsv } from '../../exportCsv';
import { AdminPage } from '../../ui/AdminPage';
import { adminButton } from '../../ui/adminButton';
import { ButtonGroup } from '../../ui/ButtonGroup';
import { AtsSpreadCard } from '../analytics/AtsSpreadCard';
import { FunnelCard } from '../analytics/FunnelCard';
import { ProviderUsageCard } from '../analytics/ProviderUsageCard';
import { RetentionCard } from '../analytics/RetentionCard';
import { GenerationsByKindCard, QuotaConsumptionCard } from '../analytics/UsageCards';
import { IconButton } from '../ui/BusinessParts';

const RANGES: { id: AnalyticsRange; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

/** The page's aggregates as rows of (section, measure, value): no more than the page shows. */
function analyticsRows(page: AdminAnalyticsPage): (string | number)[][] {
  const rows: (string | number)[][] = [['section', 'measure', 'value']];
  for (const step of page.funnel?.steps ?? []) rows.push(['funnel', step.label, step.count]);
  for (const cohort of page.retention?.cohorts ?? []) {
    cohort.weeks.forEach((cell, week) => {
      if ('rate' in cell) rows.push(['retention', `${cohort.label} week ${week}`, cell.rate]);
    });
  }
  for (const kind of page.generations?.rows ?? []) rows.push(['runs', kind.label, kind.count]);
  for (const bucket of page.ats?.buckets ?? []) {
    rows.push(['ats checks', `${bucket.from}-${bucket.to}`, bucket.count]);
  }
  for (const quota of page.quota?.rows ?? []) rows.push(['at cap', quota.label, quota.atCapShare]);
  for (const usage of page.providerUsage?.rows ?? []) {
    rows.push(['model cost usd', usage.tag, usage.costUsd]);
    rows.push(['model calls', usage.tag, usage.calls]);
  }
  rows.push(['window', 'range', page.range]);
  return rows;
}

/**
 * Product analytics (Figma 407:1430): the activation funnel and week-4 retention, runs by kind,
 * ATS scores and quota pressure, and model cost by pipeline tag. Counts and rates across all
 * users, never individuals (V2 §7.17).
 */
export function AnalyticsScreen() {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const analytics = useAdminAnalytics(range);
  const data = analytics.data;
  // While a new window loads, the last one's figures stay up, dimmed and labelled as theirs; a
  // window that failed to load shows the error, never the previous window's figures.
  const stale = data !== undefined && data.range !== range;
  const updating = analytics.isPlaceholderData;

  return (
    <AdminPage
      title="Analytics"
      subtitle="Product funnel, retention, usage and model cost. Counts and rates across all users, never individuals."
      actions={
        <>
          <ButtonGroup
            size="md"
            label="Time window"
            options={RANGES}
            value={range}
            onChange={setRange}
          />
          <IconButton
            icon="Download01"
            disabled={!data}
            onClick={() =>
              data && downloadCsv(`nextkin-analytics-${data.range}.csv`, analyticsRows(data))
            }
            className={adminButton.secondary}
          >
            Export
          </IconButton>
        </>
      }
    >
      {analytics.isError && (!data || stale) ? (
        <StateView
          tone="danger"
          title="Couldn’t load analytics"
          message="The figures didn’t arrive. Nothing has changed on the platform."
          actionLabel="Try again"
          onAction={() => void analytics.refetch()}
        />
      ) : !data ? (
        <div aria-hidden className="flex flex-col gap-6">
          <div className="grid gap-4 @admin-lg/admin:grid-cols-2">
            <Skeleton className="h-[516px] rounded-lg" />
            <Skeleton className="h-[516px] rounded-lg" />
          </div>
          <div className="grid gap-4 @admin-lg/admin:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-[431px] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[510px] rounded-lg" />
        </div>
      ) : (
        <div
          aria-busy={updating || undefined}
          className={cn(
            'flex flex-col gap-6 transition-opacity duration-fast ease-standard',
            updating && 'opacity-60',
          )}
        >
          <div className="grid gap-4 @admin-lg/admin:grid-cols-2">
            <FunnelCard funnel={data.funnel} range={data.range} />
            <RetentionCard retention={data.retention} />
          </div>
          <div className="grid gap-4 @admin-lg/admin:grid-cols-3">
            <GenerationsByKindCard generations={data.generations} />
            <AtsSpreadCard ats={data.ats} />
            <QuotaConsumptionCard quota={data.quota} />
          </div>
          <ProviderUsageCard usage={data.providerUsage} range={data.range} />
        </div>
      )}
    </AdminPage>
  );
}
