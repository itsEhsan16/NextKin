'use client';

import { cn } from '@/lib/cn';

import { formatAxis, formatCount, formatRate } from '../format';
import { chartScale } from './scale';
import { useChartFocus } from './useChartFocus';

export type HistogramBucket = { from: number; to: number; count: number };

const fillOf = (bucket: HistogramBucket, mean: number | null) =>
  mean !== null && mean >= bucket.from && mean < bucket.to
    ? 'bg-brand-700'
    : bucket.from >= 50
      ? 'bg-brand-500'
      : 'bg-brand-200';

/**
 * How ATS scores spread across 0–100 (Figma 396:653): ten buckets on a gridded count scale, the
 * bucket holding the mean darkest, the upper half mid-indigo, the lower half pale, and a marker at
 * the mean. Hovering or focusing a bucket lifts it, dims the rest and says how many checks fell in
 * that band and what share of all checks that is.
 */
export function Histogram({
  buckets,
  mean,
}: {
  buckets: readonly HistogramBucket[];
  mean: number | null;
}) {
  const { active, bind } = useChartFocus<number>();
  // The bucket the mean falls in: the marker sits inside it, at the mean's place in its band, so
  // 71.4 is 14% of the way across the 70–80 bar rather than at 71.4% of a width with gaps in it.
  const meanAt =
    mean === null
      ? -1
      : buckets.findIndex((b, i) => mean >= b.from && (mean < b.to || i === buckets.length - 1));
  const { ticks, top } = chartScale(Math.max(0, ...buckets.map((b) => b.count)), 3);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const at = (value: number) => `${(value / top) * 100}%`;
  const describe = (b: HistogramBucket) =>
    `Score ${b.from}–${b.to}: ${formatCount(b.count)} checks, ${formatRate(total ? b.count / total : 0, 0)}`;

  return (
    <figure aria-label="Checks per score band" className="flex flex-col">
      <div className="flex h-40 gap-1">
        <div aria-hidden className="relative w-6 shrink-0">
          {ticks.map((tick) => (
            <span
              key={tick}
              style={{ bottom: at(tick) }}
              className="absolute left-0 translate-y-1/2 text-caption-m font-normal text-text-tertiary"
            >
              {formatAxis(tick, ticks[ticks.length - 1] ?? 0)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {ticks.map((tick) => (
            <div
              key={tick}
              aria-hidden
              style={{ bottom: at(tick) }}
              className={cn(
                'absolute inset-x-0 h-px',
                tick === 0 ? 'bg-neutral-200' : 'bg-neutral-100',
              )}
            />
          ))}

          <ol className="absolute inset-0 flex items-end gap-1.5 px-0.5">
            {buckets.map((bucket, index) => {
              const shown = active === index;
              return (
                <li
                  key={bucket.from}
                  tabIndex={0}
                  aria-label={describe(bucket)}
                  {...bind(index)}
                  className="group/bucket relative flex h-full flex-1 cursor-default items-end outline-none"
                >
                  <span
                    aria-hidden
                    style={{
                      height: at(bucket.count),
                      animationDelay: `calc(${index} * var(--stagger-step))`,
                    }}
                    className={cn(
                      'w-full origin-bottom animate-bar-grow rounded-t-tag transition-[height,opacity,filter] duration-fast ease-standard group-focus-visible/bucket:ring-2 group-focus-visible/bucket:ring-brand-600 group-focus-visible/bucket:ring-offset-1',
                      fillOf(bucket, mean),
                      active !== null && !shown && 'opacity-35',
                      shown && 'brightness-95',
                    )}
                  />
                  {index === meanAt && mean !== null && (
                    <span
                      aria-hidden
                      style={{
                        left: `${((mean - bucket.from) / (bucket.to - bucket.from)) * 100}%`,
                      }}
                      className={cn(
                        'pointer-events-none absolute -top-1 bottom-0 z-10 w-[1.5px] -translate-x-1/2 animate-reveal bg-neutral-900 transition-opacity duration-fast ease-standard',
                        active !== null && 'opacity-0',
                      )}
                    >
                      <span className="absolute -top-0.5 right-1 whitespace-nowrap rounded-admin-sm bg-neutral-900 px-1.5 py-0.5 text-caption-m font-semibold text-text-inverse">
                        Mean {mean}
                      </span>
                    </span>
                  )}
                  {shown && (
                    <BucketTooltip
                      bucket={bucket}
                      share={total ? bucket.count / total : 0}
                      bottom={at(bucket.count)}
                      // A tall bar's tooltip would rise over the card's heading, so it sits beside
                      // the bar instead, on the side with room.
                      align={
                        bucket.count / top > 0.55
                          ? index >= buckets.length / 2
                            ? 'beside-left'
                            : 'beside-right'
                          : index < 2
                            ? 'start'
                            : index > buckets.length - 3
                              ? 'end'
                              : 'center'
                      }
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* The score axis, on the same grid as the bars: each label sits on the edge between two
          buckets (mid-gap), so "80" is where the 70–80 bucket ends. */}
      <div
        aria-hidden
        className="ml-7 flex gap-1.5 px-0.5 pt-3 text-caption-m font-normal text-text-tertiary"
      >
        {buckets.map((bucket, index) => (
          <span key={bucket.from} className="relative h-[18px] flex-1">
            {index % 2 === 0 && (
              <span
                className={cn(
                  'absolute top-0 -translate-x-1/2',
                  index === 0 ? 'left-0' : '-left-0.75',
                )}
              >
                {bucket.from}
              </span>
            )}
            {index === buckets.length - 1 && (
              <span className="absolute right-0 top-0 translate-x-1/2">{bucket.to}</span>
            )}
          </span>
        ))}
      </div>
    </figure>
  );
}

function BucketTooltip({
  bucket,
  share,
  bottom,
  align,
}: {
  bucket: HistogramBucket;
  share: number;
  bottom: string;
  align: 'start' | 'center' | 'end' | 'beside-left' | 'beside-right';
}) {
  const beside = align === 'beside-left' || align === 'beside-right';
  return (
    <div
      role="tooltip"
      style={beside ? { top: 0 } : { bottom: `calc(${bottom} + 8px)` }}
      className={cn(
        'pointer-events-none absolute z-20 flex w-max animate-pop-in flex-col gap-0.5 rounded-sm border border-neutral-200 bg-surface-card px-3 py-2 shadow-popover',
        align === 'start' && 'left-0',
        align === 'center' && 'left-1/2 -translate-x-1/2',
        align === 'end' && 'right-0',
        align === 'beside-left' && 'right-[calc(100%+8px)]',
        align === 'beside-right' && 'left-[calc(100%+8px)]',
      )}
    >
      <p className="text-caption-m font-semibold text-text-primary">
        Score {bucket.from}–{bucket.to}
      </p>
      <p className="text-caption-m font-normal text-text-secondary">
        <span className="font-semibold text-text-primary">{formatCount(bucket.count)}</span> checks
        · {formatRate(share, 0)}
      </p>
    </div>
  );
}
