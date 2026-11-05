import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type MeterSegment = { key: string; value: number; fill: string };

export type SegmentMeterProps = {
  segments: readonly MeterSegment[];
  /** The segment in focus, shared with the list beside it (`useChartFocus`); none by default. */
  active?: string | null;
  bind?: (key: string) => Record<string, () => void>;
  /** What the tooltip over the segment in focus says. */
  tooltip?: (key: string) => ReactNode;
  className?: string;
};

/**
 * A bar split into shares (Figma 396:573): each segment's width is its share of the whole, with a
 * 2px gap between them, and each grows in from the left on arrival. Pointing at a segment, or at
 * its row in the list it belongs to, lifts it, fades the rest and says what it is. The list
 * carries the same figures as text, so the bar is hidden from assistive tech.
 */
export function SegmentMeter({
  segments,
  active = null,
  bind,
  tooltip,
  className,
}: SegmentMeterProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const shown = segments.filter((segment) => segment.value > 0);
  const before = (key: string) => {
    let sum = 0;
    for (const segment of shown) {
      if (segment.key === key) return sum + segment.value / 2;
      sum += segment.value;
    }
    return sum;
  };

  return (
    <div className={cn('relative', className)}>
      <div aria-hidden className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {shown.map((segment) => (
          <span
            key={segment.key}
            {...(bind ? bind(segment.key) : {})}
            // Grow by share rather than a % width: widths plus the 2px gaps overflowed the track and
            // clipped the last segment.
            style={{ flexGrow: segment.value, flexBasis: 0 }}
            className={cn(
              'h-full min-w-0 animate-meter-grow cursor-default transition-[width,opacity] duration-fast ease-standard first:rounded-l-full last:rounded-r-full',
              segment.fill,
              active !== null && active !== segment.key && 'opacity-35',
            )}
          />
        ))}
      </div>
      {active !== null && tooltip && total > 0 && (
        <div
          aria-hidden
          style={{ left: `clamp(56px, ${(before(active) / total) * 100}%, calc(100% - 56px))` }}
          className="pointer-events-none absolute bottom-[calc(100%+8px)] z-20 w-max -translate-x-1/2 animate-pop-in rounded-sm border border-neutral-200 bg-surface-card px-3 py-1.5 text-caption-m shadow-popover"
        >
          {tooltip(active)}
        </div>
      )}
    </div>
  );
}
