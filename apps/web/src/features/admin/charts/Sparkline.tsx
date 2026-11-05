'use client';

import { useId } from 'react';

import { smoothPath } from '@/features/insights/insightsLibrary';
import { colors } from '@/theme/tokens';

/** The board's sparkline box (Figma 395:541): 84×38, a 2px line over a fading wash. */
const W = 86;
const H = 38;
const PAD = 1;

export type SparklineProps = {
  values: readonly number[];
  /** Red where the trend is the bad direction (Generation reliability falling). */
  tone?: 'brand' | 'danger';
};

/**
 * A card's trend over the window, oldest first (Figma 395:541). Decorative: the card states the
 * figure and its change in words, so the line is hidden from assistive tech. It draws itself in
 * from the left on arrival.
 */
export function Sparkline({ values, tone = 'brand' }: SparklineProps) {
  const gradient = useId();
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => ({
    x: PAD + (index / (values.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - (value - min) / span) * (H - PAD * 2 - 3),
  }));
  const line = smoothPath(points);
  const last = points[points.length - 1]!;
  const ink = tone === 'danger' ? colors.danger600 : colors.brand600;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      className="h-[38px] w-[84px] shrink-0 animate-reveal overflow-visible"
      fill="none"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ink} stopOpacity="0.16" />
          <stop offset="1" stopColor={ink} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${last.x},${H - 3} L${PAD},${H - 3} Z`} fill={`url(#${gradient})`} />
      <path
        d={line}
        stroke={ink}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        className="animate-line-draw"
      />
    </svg>
  );
}
