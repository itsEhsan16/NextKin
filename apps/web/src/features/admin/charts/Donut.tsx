import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** The board's donut (Figma 396:617): 136px across, an 18px ring; one in focus thickens to 24. */
const SIZE = 136;
const STROKE = 18;
const STROKE_ACTIVE = 24;
// The resting ring fills the 136px box, as the board draws it; a thickened one spills 3px past
// it (the svg's overflow is visible).
const R = (SIZE - STROKE) / 2;
/** The white gap between two segments, in hundredths of the ring. */
const GAP = 1;

export type DonutSegment = { key: string; value: number; stroke: string };

export type DonutProps = {
  segments: readonly DonutSegment[];
  /** The segment in focus, shared with the legend beside it (`useChartFocus`). */
  active: string | null;
  /** The handlers that put a segment in focus. */
  bind: (key: string) => Record<string, () => void>;
  children: ReactNode;
};

/**
 * Shares of a whole as a ring (Figma 396:617), with the total in the middle. Each segment sweeps
 * in on arrival. Pointing at a segment, or at its row in the legend, thickens it and fades the
 * rest; the card swaps the middle for that segment's own figure. The legend carries the same
 * figures as text, so the ring is hidden from assistive tech.
 */
export function Donut({ segments, active, bind, children }: DonutProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const shares = segments.map((segment) => (total ? (segment.value / total) * 100 : 0));
  // Where each segment starts round the ring: the shares before it, added up.
  const starts = shares.map((_, index) => shares.slice(0, index).reduce((sum, s) => sum + s, 0));

  return (
    <div className="relative size-[136px] shrink-0">
      <svg
        aria-hidden
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-full -rotate-90 overflow-visible"
        fill="none"
      >
        {segments.map((segment, index) => {
          const length = Math.max(0, (shares[index] ?? 0) - GAP);
          const offset = -(starts[index] ?? 0);
          const shown = active === segment.key;
          return (
            <circle
              key={segment.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              pathLength={100}
              strokeWidth={shown ? STROKE_ACTIVE : STROKE}
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={offset}
              {...bind(segment.key)}
              className={cn(
                'animate-reveal cursor-default transition-[stroke-width,opacity] duration-fast ease-standard',
                segment.stroke,
                active !== null && !shown && 'opacity-35',
              )}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
