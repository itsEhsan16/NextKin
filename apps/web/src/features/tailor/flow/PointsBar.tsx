'use client';

import type { ScorePart } from '@nextkin/shared/scoring/fixPlan';

import { cn } from '@/lib/cn';
import { AlertTriangle } from '@/ui/lineIcons';

/** Rubric order, so the bar reads the same for every job. */
const ORDER = ['keywords', 'timeline', 'sections', 'formatting', 'achievements'] as const;

/**
 * "Where your points go" (850:228): the 10 points as one bar, each part as wide as its weight and
 * filled to what the resume earns now, what it loses under it, and the biggest loss named.
 */
export function PointsBar({ parts }: { parts: readonly ScorePart[] }) {
  const ordered = ORDER.map((key) => parts.find((p) => p.key === key)).filter(
    (p): p is ScorePart => p !== undefined,
  );
  const worst = [...parts].sort((a, b) => b.lost - a.lost)[0];
  return (
    <div className="flex flex-col gap-3.5 px-8 pb-8 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title-l font-bold text-text-primary">Where your points go</h2>
        {worst && worst.lost > 0 && (
          <p className="flex items-center gap-1.5 text-body-m font-semibold text-warning-text">
            <AlertTriangle aria-hidden className="size-4.5" />
            Biggest loss: {worst.label}, −{worst.lost.toFixed(1)}
          </p>
        )}
      </div>
      <ul aria-label="Your score by part" className="flex gap-1.5">
        {ordered.map((part) => {
          const filled = part.max > 0 ? Math.min(100, (part.got / part.max) * 100) : 0;
          return (
            <li
              key={part.key}
              className="flex min-w-0 flex-col gap-2"
              style={{ flexGrow: part.max, flexBasis: 0 }}
            >
              <div
                role="img"
                aria-label={`${part.label}: ${part.got.toFixed(1)} of ${part.max.toFixed(1)}`}
                title={part.basis}
                className="h-3 overflow-hidden rounded-full bg-neutral-100"
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-meter ease-decelerate',
                    filled >= 99 ? 'bg-success-600' : 'bg-brand-600',
                  )}
                  style={{ width: `${filled}%` }}
                />
              </div>
              <div className="min-w-0 text-body-m">
                <p className="truncate font-semibold text-neutral-700">{part.label}</p>
                <p className="flex gap-1.5 truncate">
                  <span className="text-text-tertiary">
                    {part.got.toFixed(1)} / {part.max.toFixed(1)}
                  </span>
                  {part.lost > 0 && (
                    <span className="font-semibold text-warning-text">−{part.lost.toFixed(1)}</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-body-s font-medium text-text-tertiary">
        Width is each part’s weight; the fill is what you earn now.
      </p>
    </div>
  );
}
