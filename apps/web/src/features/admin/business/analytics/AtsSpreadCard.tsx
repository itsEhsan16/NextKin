'use client';

import type { AnalyticsAts } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';

import { useChartFocus } from '../../charts/useChartFocus';
import { formatCount, formatRate } from '../../format';
import { AdminBadge, TrendBadge } from '../../ui/AdminBadge';
import { AdminCard, CardEmpty, NotConnected } from '../../ui/AdminCard';

/** Scores below this are the pale group the legend counts (Figma 408:1237). */
const PASS = 60;

/** A band as the legend names it: "70–79"; the top band keeps its 100. */
const bandName = (band: { from: number; to: number }) =>
  `${band.from}–${band.to >= 100 ? band.to : band.to - 1}`;

/** A band's share of checks; one that rounds to nothing but isn't empty reads "<1%". */
const shareText = (count: number, checks: number) =>
  count > 0 && count / checks < 0.005 ? '<1%' : formatRate(count / checks, 0);

/**
 * ATS scores across the platform (Figma 408:1237): the mean, its change, the checks and the
 * median, then the spread in ten bands. This board draws the bars alone, with no count axis or
 * mean marker, so it is its own chart rather than the Overview's histogram. Bars are scaled to the
 * fullest band. The most common band is darkest, scores of 60 and up indigo, the rest the same
 * indigo at 30%. Pointing at a band says what it holds.
 */
export function AtsSpreadCard({ ats }: { ats: AnalyticsAts | null }) {
  const checks = ats?.buckets.reduce((sum, b) => sum + b.count, 0) ?? 0;
  return (
    <AdminCard
      icon="BarChart10"
      title="ATS score distribution"
      trailing={
        ats?.rubricVersion ? (
          <AdminBadge tone="brand">Rubric {ats.rubricVersion}</AdminBadge>
        ) : undefined
      }
      bodyClassName="gap-4"
    >
      {!ats ? (
        <NotConnected what="ATS scores" />
      ) : checks === 0 ? (
        <CardEmpty title="No checks yet" message="Scores show here once people run an ATS check." />
      ) : (
        <Spread ats={ats} checks={checks} />
      )}
    </AdminCard>
  );
}

function Spread({ ats, checks }: { ats: AnalyticsAts; checks: number }) {
  const { active, bind } = useChartFocus<number>();
  const top = Math.max(...ats.buckets.map((b) => b.count));
  const most = ats.buckets.reduce(
    (best, b, index) => (b.count > (ats.buckets[best]?.count ?? 0) ? index : best),
    0,
  );
  const mostBand = ats.buckets[most]!;
  const below = ats.buckets.filter((b) => b.to <= PASS).reduce((sum, b) => sum + b.count, 0);
  const fill = (index: number, from: number) =>
    index === most ? 'bg-brand-700' : from >= PASS ? 'bg-brand-600' : 'bg-brand-600/30';
  // The axis marks every other band edge, spread evenly as the board's flex row does (408:1306).
  const ticks = [
    ...ats.buckets.filter((_, index) => index % 2 === 0).map((b) => b.from),
    ats.buckets[ats.buckets.length - 1]!.to,
  ];
  const facts = [
    ats.mean !== null && 'mean score',
    `${formatCount(checks)} checks`,
    ats.median !== null && `median ${ats.median}`,
  ].filter(Boolean);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <p className="animate-reveal text-display-l font-semibold tracking-display text-text-primary">
            {ats.mean ?? formatCount(checks)}
          </p>
          {ats.deltaPoints !== null && (
            // The board writes the bare change ("2.1"); the unit is read out, not shown.
            <TrendBadge up={ats.deltaPoints >= 0}>
              {Math.abs(ats.deltaPoints).toFixed(1)}
              <span className="sr-only"> points</span>
            </TrendBadge>
          )}
        </div>
        <p className="text-body-s text-text-secondary">{facts.join(' · ')}</p>
      </div>

      <figure aria-label="Checks per score band" className="flex flex-col gap-4">
        <ol className="flex h-[150px] items-end gap-1.5 border-b border-neutral-200 pt-[3px]">
          {ats.buckets.map((bucket, index) => {
            const shown = active === index;
            return (
              <li
                key={bucket.from}
                tabIndex={0}
                aria-label={`Score ${bandName(bucket)}: ${formatCount(bucket.count)} checks, ${shareText(bucket.count, checks)}`}
                {...bind(index)}
                className="group/band relative flex h-full flex-1 cursor-default items-end outline-none"
              >
                <span
                  aria-hidden
                  style={{
                    height: `${(bucket.count / top) * 100}%`,
                    animationDelay: `calc(${index} * var(--stagger-step))`,
                  }}
                  className={cn(
                    'w-full origin-bottom animate-bar-grow rounded-t-tag transition-[opacity] duration-fast ease-standard group-focus-visible/band:ring-2 group-focus-visible/band:ring-brand-600 group-focus-visible/band:ring-offset-1',
                    fill(index, bucket.from),
                    active !== null && !shown && 'opacity-35',
                  )}
                />
                {shown && (
                  <div
                    role="tooltip"
                    className={cn(
                      'pointer-events-none absolute bottom-[calc(100%+8px)] z-tooltip w-max animate-pop-in rounded-sm border border-neutral-200 bg-surface-card px-3 py-1.5 text-caption-m shadow-popover',
                      index < 2 ? 'left-0' : index > 7 ? 'right-0' : 'left-1/2 -translate-x-1/2',
                    )}
                  >
                    <span className="font-semibold text-text-primary">
                      Score {bandName(bucket)}
                    </span>
                    <span className="text-text-secondary">
                      {' '}
                      · {formatCount(bucket.count)} checks · {shareText(bucket.count, checks)}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <div
          aria-hidden
          className="flex justify-between text-caption-m font-normal text-text-tertiary"
        >
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      </figure>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption-m font-normal text-text-secondary">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-brand-600/30" />
          Below {PASS} · {shareText(below, checks)}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-brand-600" />
          {PASS} and above
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-brand-700" />
          Most common · {bandName(mostBand)}
        </li>
      </ul>
    </>
  );
}
