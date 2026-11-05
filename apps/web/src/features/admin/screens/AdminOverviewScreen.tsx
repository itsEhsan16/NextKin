'use client';

import { useState } from 'react';

import { ADMIN_RANGE_LABEL, type AdminOverview, type AdminRange } from '@nextkin/shared/models';
import { useAdminMe, useAdminOverview, useAdminQueues } from '@nextkin/shared/queries';

import { cn } from '@/lib/cn';
import { AdminIcon, useIconHover } from '@/ui/animated/AdminIcon';
import { FilterCheckboxItem, FilterDropdown } from '@/ui/FilterDropdown';
import { chevronTurn, menuTrigger } from '@/ui/menuMotion';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { downloadCsv, overviewRows } from '../exportCsv';
import { ActivityCard } from '../overview/components/ActivityCard';
import { AiCostCard } from '../overview/components/AiCostCard';
import { AtsCard } from '../overview/components/AtsCard';
import { GenerationsCard } from '../overview/components/GenerationsCard';
import {
  KPI_KEYS,
  KpiCard,
  KpiCardSkeleton,
  KpiCardUnavailable,
} from '../overview/components/KpiCard';
import { NeedsAttentionCard } from '../overview/components/NeedsAttentionCard';
import { PipelineCard } from '../overview/components/PipelineCard';
import { ProvidersCard } from '../overview/components/ProvidersCard';
import { SubscriptionsCard } from '../overview/components/SubscriptionsCard';
import { adminButton } from '../ui/adminButton';

const RANGES = Object.keys(ADMIN_RANGE_LABEL) as AdminRange[];

/**
 * The admin Overview, Direction A "Light ops" (Figma 394:536): the four headline figures, AI runs
 * per day, the work queues and pipeline health, then cost, subscriptions, ATS scores and job
 * providers, and the newest staff actions. Aggregates only (V2 §7.17): no user is named on this
 * page, and audit targets are masked.
 *
 * The layout follows the width the sidebar leaves: the queue column sits beside the chart from
 * 1400px of content and under it below that; the four lower cards go two by two below 1200.
 */
export function AdminOverviewScreen() {
  const [range, setRange] = useState<AdminRange>('30d');
  const me = useAdminMe();
  const overview = useAdminOverview(range);
  const queues = useAdminQueues();
  const data = overview.data;
  // While a new window loads, the last window's figures stay on screen, labelled as what they
  // are (`data.range`) and dimmed, and Export waits for the window that was asked for.
  const updating = overview.isPlaceholderData;
  const meFailed = me.isError && !me.data;

  return (
    <div className="flex flex-col gap-6 px-8 pb-10 pt-8">
      <header className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* The board's title tracks -1.5%, a little looser than the display role's -2%. */}
          <h1 className="text-display-l font-semibold tracking-[-0.015em] text-text-primary">
            {me.data ? (
              `Welcome back, ${me.data.name}`
            ) : meFailed ? (
              'Overview'
            ) : (
              <Skeleton as="span" className="inline-block h-8 w-72 align-middle" />
            )}
          </h1>
          <p className="text-title-l font-normal tracking-normal text-text-secondary">
            Track users, AI runs and billing across NextKin. Aggregates only — no personal data on
            this page.
          </p>
        </div>
        <RangePicker range={range} onChange={setRange} />
        <ExportButton overview={updating ? undefined : data} />
      </header>

      {overview.isError && !data ? (
        <StateView
          tone="danger"
          title="Couldn’t load the Overview"
          message="The figures didn’t arrive. Nothing has changed on the platform."
          actionLabel="Try again"
          onAction={() => void overview.refetch()}
        />
      ) : (
        <div
          aria-busy={updating || undefined}
          className={cn(
            'flex flex-col gap-6 transition-opacity duration-base ease-standard',
            updating && 'opacity-60',
          )}
        >
          <div className="grid gap-6 @min-[1400px]/admin:grid-cols-[minmax(0,1fr)_400px]">
            <div className="flex min-w-0 flex-col gap-6">
              <div className="grid grid-cols-2 gap-4 @min-[900px]/admin:grid-cols-4">
                {KPI_KEYS.map((key) => {
                  if (!data) return <KpiCardSkeleton key={key} kpiKey={key} />;
                  const kpi = data.kpis.find((k) => k.key === key);
                  if (kpi) return <KpiCard key={key} kpi={kpi} range={data.range} />;
                  const unmeasured = data.unmeasured?.includes(key);
                  return (
                    <KpiCardUnavailable
                      key={key}
                      kpiKey={key}
                      reason={unmeasured ? 'unmeasured' : 'notConnected'}
                    />
                  );
                })}
              </div>
              {data ? (
                <GenerationsCard generations={data.generations} range={data.range} />
              ) : (
                <CardSkeleton tall />
              )}
            </div>
            {/* `items-start`: side by side, Pipeline keeps its own height rather than Needs attention's. */}
            <div className="grid content-start items-start gap-6 @min-[900px]/admin:grid-cols-2 @min-[1400px]/admin:grid-cols-1">
              <NeedsAttentionCard
                queues={queues.data}
                permissions={me.data?.permissions}
                loading={queues.isPending || me.isPending}
                error={queues.isError || meFailed}
                onRetry={() => {
                  if (queues.isError) void queues.refetch();
                  if (meFailed) void me.refetch();
                }}
              />
              {data ? <PipelineCard pipeline={data.pipeline} /> : <CardSkeleton />}
            </div>
          </div>

          <div className="grid gap-6 @min-[700px]/admin:grid-cols-2 @min-[1400px]/admin:grid-cols-4">
            {data ? (
              <>
                <AiCostCard cost={data.aiCost} range={data.range} />
                <SubscriptionsCard subscriptions={data.subscriptions} />
                <AtsCard ats={data.ats} />
                <ProvidersCard providers={data.providers} />
              </>
            ) : (
              Array.from({ length: 4 }, (_, index) => <CardSkeleton key={index} />)
            )}
          </div>
        </div>
      )}

      {/* The rows are the audit log's: a role without `audit.read` (a curator) isn't shown them,
          as the server would refuse them and the sidebar has no Audit log row for it. */}
      {me.isPending ? (
        <ActivityCard enabled={false} />
      ) : me.data?.permissions.includes('audit.read') ? (
        <ActivityCard enabled />
      ) : null}
    </div>
  );
}

function RangePicker({
  range,
  onChange,
}: {
  range: AdminRange;
  onChange: (range: AdminRange) => void;
}) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <FilterDropdown
      align="end"
      trigger={
        <button
          type="button"
          aria-label={`Time window: ${ADMIN_RANGE_LABEL[range]}`}
          {...hoverProps}
          className={cn(adminButton.secondary, menuTrigger)}
        >
          <AdminIcon ref={iconRef} name="Calendar" />
          {ADMIN_RANGE_LABEL[range]}
          <AdminIcon name="ChevronDown" size="sm" className={cn('text-neutral-500', chevronTurn)} />
        </button>
      }
    >
      {RANGES.map((option) => (
        <FilterCheckboxItem
          key={option}
          checked={option === range}
          onCheckedChange={() => onChange(option)}
          closeOnSelect
        >
          {ADMIN_RANGE_LABEL[option]}
        </FilterCheckboxItem>
      ))}
    </FilterDropdown>
  );
}

/**
 * Saves what the page shows for the window as a CSV (aggregates only, like the page). Waits for
 * the figures; nothing is fetched beyond what is on screen.
 */
function ExportButton({ overview }: { overview: AdminOverview | undefined }) {
  const { iconRef, hoverProps } = useIconHover();
  return (
    <button
      type="button"
      disabled={!overview}
      onClick={() =>
        overview && downloadCsv(`nextkin-overview-${overview.range}.csv`, overviewRows(overview))
      }
      {...hoverProps}
      className={adminButton.primary}
    >
      <AdminIcon ref={iconRef} name="Download01" />
      Export
    </button>
  );
}

function CardSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div aria-hidden className="rounded-lg border border-neutral-200 bg-neutral-50 p-1">
      <Skeleton className="m-3 h-4 w-32" />
      <Skeleton className={cn('rounded-md', tall ? 'h-[420px]' : 'h-[260px]')} />
    </div>
  );
}
