'use client';

import type { AnalyticsFunnel, AnalyticsRange } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { useChartFocus } from '../../charts/useChartFocus';
import { formatCount, formatRate, RANGE_DAYS } from '../../format';
import { AdminBadge, DeltaBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';

/** The board's ramp down the funnel (Figma 407:1596, 407:1673, 407:1675): each step a step paler. */
const STEP_FILL = [
  'bg-brand-600',
  'bg-brand-500',
  'bg-brand-600/55',
  'bg-brand-600/35',
  'bg-brand-100',
];
const fillAt = (index: number) => STEP_FILL[Math.min(index, STEP_FILL.length - 1)]!;

/**
 * The activation funnel (Figma 407:1596): from sign-up to starting Pro, each step's count as a
 * bar against the first, its share of sign-ups, and how many carried on to the next. The weakest
 * hand-off is amber. Pointing at a step lifts its bar and fades the rest.
 */
export function FunnelCard({
  funnel,
  range,
}: {
  funnel: AnalyticsFunnel | null;
  range: AnalyticsRange;
}) {
  return (
    <AdminCard
      icon="Activity"
      title="Activation funnel"
      trailing={
        <AdminBadge tone="neutral" icon={<AdminIcon name="Lock01" size="xs" />}>
          Aggregate only · no personal data
        </AdminBadge>
      }
      bodyClassName="gap-5"
    >
      {!funnel ? (
        <NotConnected what="the activation funnel" />
      ) : funnel.steps.length === 0 || (funnel.steps[0]?.count ?? 0) === 0 ? (
        <CardEmpty
          title="No sign-ups in this window"
          message="The funnel fills in as people sign up."
        />
      ) : (
        <Body funnel={funnel} range={range} />
      )}
    </AdminCard>
  );
}

function Body({ funnel, range }: { funnel: AnalyticsFunnel; range: AnalyticsRange }) {
  const { active, bind } = useChartFocus<number>();
  const first = funnel.steps[0]!.count;
  const last = funnel.steps[funnel.steps.length - 1]!.count;
  const handoffs = funnel.steps.slice(1).map((step, index) => {
    const before = funnel.steps[index]!.count;
    return before ? step.count / before : 0;
  });
  const weakest = handoffs.indexOf(Math.min(...handoffs));

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <p className="animate-reveal text-display-l font-semibold tracking-[-0.015em] text-text-primary">
            {formatRate(funnel.conversion)}
          </p>
          {funnel.deltaPoints !== null && (
            <DeltaBadge delta={{ value: funnel.deltaPoints, unit: 'points' }} />
          )}
        </div>
        <p className="text-body-s text-text-secondary">
          of sign-ups started Pro within {RANGE_DAYS[range]} days ({formatCount(last)} of{' '}
          {formatCount(first)})
        </p>
      </div>

      <ol aria-label="Activation funnel" className="flex flex-col">
        {funnel.steps.map((step, index) => {
          const share = step.count / first;
          const handoff = handoffs[index];
          const shown = active === index;
          const shareText =
            index === funnel.steps.length - 1 ? formatRate(share) : formatRate(share, 0);
          return (
            <li key={step.key} className="flex flex-col">
              <div
                tabIndex={0}
                role="img"
                aria-label={`${step.label}: ${formatCount(step.count)}, ${shareText} of sign-ups`}
                {...bind(index)}
                className="group/step flex h-[38px] cursor-default items-center gap-4 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <div className="flex w-[184px] shrink-0 flex-col">
                  <span className="truncate text-body-s font-semibold text-text-primary">
                    {step.label}
                  </span>
                  <span className="text-caption-m font-normal text-text-tertiary">
                    {shareText} of sign-ups
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden
                    style={{
                      width: `max(8px, calc((100% - 64px) * ${share}))`,
                      animationDelay: `calc(${index} * var(--stagger-step))`,
                    }}
                    className={cn(
                      'h-8 shrink-0 origin-left animate-meter-grow rounded-[6px] transition-[opacity,filter] duration-fast ease-standard',
                      fillAt(index),
                      active !== null && !shown && 'opacity-35',
                      shown && 'brightness-95',
                    )}
                  />
                  <span className="text-body-s font-semibold tabular-nums text-text-primary">
                    {formatCount(step.count)}
                  </span>
                </div>
              </div>
              {handoff !== undefined && (
                <div aria-hidden className="flex h-9 items-center gap-2 pl-[200px]">
                  <AdminBadge
                    tone={index === weakest ? 'warning' : 'neutral'}
                    icon={<AdminIcon name="ArrowDown" size="xs" />}
                  >
                    {(handoff * 100).toFixed(1)}%
                  </AdminBadge>
                  <span className="text-caption-m font-normal text-text-tertiary">
                    continue to the next step
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
