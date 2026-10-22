'use client';

import type { CareerInsights } from '@nextkin/shared/models';
import { useId, useState, type PointerEvent } from 'react';

import { formatMonthDay as shortDate } from '@/lib/format';

import { chartCeiling, smoothPath } from '../insightsLibrary';

/** The plot's own coordinate box; the SVG stretches it to the card's width. */
const W = 476;
const H = 170;
const TICKS = 5;

/**
 * Jobs analyzed over the window (462:8): gridlines at quarters of a round ceiling, the curve over
 * a fading fill, five dates under it, and a tooltip on the latest day — or on whichever day the
 * pointer is over.
 */
export function CareerProgressChart({
  progress,
  caption,
}: {
  progress: CareerInsights['progress'];
  caption: string;
}) {
  const gradient = useId();
  const [hover, setHover] = useState<number | null>(null);
  const last = progress.length - 1;
  const ceiling = chartCeiling(Math.max(...progress.map((point) => point.total), 0));
  const points = progress.map((point, index) => ({
    x: last === 0 ? 0 : (index / last) * W,
    y: H - (point.total / ceiling) * H,
  }));
  const line = smoothPath(points);
  const area = points.length ? `${line} L${W},${H} L0,${H} Z` : '';
  const active = hover ?? last;
  const at = points[active];
  const point = progress[active];
  const dateIndexes = Array.from({ length: TICKS }, (_, tick) =>
    Math.round((tick / (TICKS - 1)) * last),
  );

  const track = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setHover(Math.min(last, Math.max(0, Math.round(ratio * last))));
  };

  return (
    <figure className="relative">
      <figcaption className="sr-only">
        {point ? `${point.total} ${caption.toLowerCase()}, as of ${shortDate(point.date)}` : ''}
      </figcaption>
      <div className="flex">
        <div aria-hidden className="relative h-[170px] w-9 shrink-0">
          {[0, 1, 2, 3].map((step) => (
            <span
              key={step}
              className="absolute left-0 w-6 -translate-y-1/2 text-right text-body-s font-medium text-text-tertiary"
              style={{ top: `${(step / 3) * 100}%` }}
            >
              {Math.round(ceiling - (step / 3) * ceiling)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            aria-hidden
            className="block h-[170px] w-full overflow-visible"
            onPointerMove={track}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand-600)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--color-brand-600)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((step) => (
              <line
                key={step}
                x1="0"
                x2={W}
                y1={(step / 3) * H}
                y2={(step / 3) * H}
                stroke={step === 3 ? 'var(--color-neutral-200)' : 'var(--color-neutral-100)'}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={area} fill={`url(#${gradient})`} />
            <path
              d={line}
              fill="none"
              stroke="var(--color-brand-600)"
              strokeWidth="2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {at && point && (
            <>
              <span
                aria-hidden
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-card bg-brand-600 shadow-card transition-[left,top] duration-fast ease-standard"
                style={{ left: `${(at.x / W) * 100}%`, top: `${(at.y / H) * 100}%` }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute w-[104px] -translate-x-[calc(100%+12px)] -translate-y-1/2 rounded-md border border-border-default bg-surface-card px-2.5 py-1.5 shadow-popover transition-[left,top] duration-fast ease-standard"
                style={{
                  left: `${Math.max((at.x / W) * 100, 26)}%`,
                  top: `${Math.max((at.y / H) * 100, 12)}%`,
                }}
              >
                <p className="text-title-l font-bold text-text-primary">{point.total}</p>
                <p className="text-micro font-medium text-text-tertiary">
                  {hover == null ? caption : `By ${shortDate(point.date)}`}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      <div aria-hidden className="relative ml-9 mt-3 h-[18px]">
        {dateIndexes.map((index, tick) => {
          const date = progress[index]?.date;
          return date ? (
            <span
              key={tick}
              className="absolute top-0 whitespace-nowrap text-body-s font-medium text-text-tertiary"
              style={{
                left: `${(index / Math.max(last, 1)) * 100}%`,
                transform: `translateX(-${(tick / (TICKS - 1)) * 100}%)`,
              }}
            >
              {shortDate(date)}
            </span>
          ) : null;
        })}
      </div>
    </figure>
  );
}
