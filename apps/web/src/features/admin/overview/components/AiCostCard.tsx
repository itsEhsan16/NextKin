'use client';

import type { AdminAiCost, AdminRange } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { SegmentMeter } from '../../charts/SegmentMeter';
import { useChartFocus } from '../../charts/useChartFocus';
import { formatUnitUsd, formatUsd, RANGE_DAYS } from '../../format';
import { AdminBadge, DeltaBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';

/** The board's stage ramp (Figma 396:574–578), largest stage darkest; the rest run out on slate. */
const STAGE_FILL = [
  'bg-brand-700',
  'bg-brand-500',
  'bg-brand-300',
  'bg-brand-200',
  'bg-neutral-200',
];
const fillAt = (index: number) =>
  STAGE_FILL[Math.min(index, STAGE_FILL.length - 1)] ?? 'bg-neutral-200';

/** What the model calls cost in the window, split by pipeline stage (Figma 396:534). */
export function AiCostCard({ cost, range }: { cost: AdminAiCost | null; range: AdminRange }) {
  const { active, bind } = useChartFocus<string>();
  const share = (usd: number) => (cost?.totalUsd ? Math.round((usd / cost.totalUsd) * 100) : 0);
  const stageOf = (key: string) => cost?.stages.find((stage) => stage.key === key);
  return (
    <AdminCard
      icon="CoinsStacked01"
      title="AI cost"
      trailing={<AdminBadge tone="neutral">By stage</AdminBadge>}
      bodyClassName="gap-4"
    >
      {!cost ? (
        <NotConnected what="AI spend" />
      ) : cost.stages.length === 0 ? (
        <CardEmpty title="No model calls yet" message="Spend shows here once the pipeline runs." />
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <p className="animate-reveal text-display-l font-semibold tracking-display text-text-primary">
                {formatUsd(cost.totalUsd)}
              </p>
              {cost.delta && <DeltaBadge delta={cost.delta} />}
            </div>
            <p className="text-body-s text-text-secondary">
              model calls, last {RANGE_DAYS[range]} days
            </p>
          </div>

          <SegmentMeter
            segments={cost.stages.map((stage, index) => ({
              key: stage.key,
              value: stage.usd,
              fill: fillAt(index),
            }))}
            active={active}
            bind={bind}
            tooltip={(key) => {
              const stage = stageOf(key);
              return (
                stage && (
                  <>
                    <span className="font-semibold text-text-primary">{stage.label}</span>
                    <span className="text-text-secondary">
                      {' '}
                      · {formatUsd(stage.usd)} · {share(stage.usd)}%
                    </span>
                  </>
                )
              );
            }}
          />

          {/* The board's rows are 20px on a 30px pitch (396:582–396:602); the focus tint sits
              outside the row's box so it adds no height. */}
          <ul className="flex flex-col gap-2.5">
            {cost.stages.map((stage, index) => (
              <li
                key={stage.key}
                tabIndex={0}
                {...bind(stage.key)}
                className={cn(
                  'relative isolate flex cursor-default items-center gap-2 text-body-s outline-none transition-opacity duration-fast ease-standard',
                  'before:absolute before:-inset-x-2 before:-inset-y-1 before:z-behind before:rounded-sm before:transition-colors before:duration-fast before:ease-standard focus-visible:before:ring-2 focus-visible:before:ring-brand-600',
                  active === stage.key && 'before:bg-neutral-50',
                  active !== null && active !== stage.key && 'opacity-50',
                )}
              >
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', fillAt(index))} />
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-700">
                  {stage.label}
                </span>
                <span className="text-text-tertiary">{share(stage.usd)}%</span>
                <span className="font-semibold tabular-nums text-text-primary">
                  {formatUsd(stage.usd)}
                </span>
              </li>
            ))}
          </ul>

          {cost.costPerResumeUsd !== null && (
            <div className="flex items-center gap-2 border-t border-neutral-100 pt-3 text-body-s">
              <span className="flex-1 text-text-secondary">Cost per generated resume</span>
              <span className="font-semibold tabular-nums text-text-primary">
                {formatUnitUsd(cost.costPerResumeUsd)}
              </span>
            </div>
          )}
        </>
      )}
    </AdminCard>
  );
}
