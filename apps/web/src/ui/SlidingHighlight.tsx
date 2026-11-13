import { useState, type CSSProperties } from 'react';

import { cn } from '@/lib/cn';

export type SlidingHighlightProps = {
  /** The selected row's place in the list, or -1 when none of its rows is selected. */
  index: number;
  /**
   * Every row's height, and the space between rows, as CSS lengths: tokens or custom properties
   * (`var(--spacing)`), not raw numbers. Every row has to be exactly `row` tall, or the
   * arithmetic below won't land on it.
   */
  row: string;
  gap: string;
  /** The look: fill, border, radius. */
  className?: string;
};

type SlideStyle = CSSProperties & {
  '--slide-index': number;
  '--slide-row': string;
  '--slide-gap': string;
};

/**
 * A selection that glides from row to row of a list, rather than each row fading its own fill in
 * and out: the sidebar's two lists (`toreview.md` §29) and the Settings sections (§31).
 *
 * The caller renders it first inside a `relative` box that holds only the rows, and makes each
 * row `relative` so it paints over it. It is placed by arithmetic rather than by measuring the
 * DOM: row N starts N × (row + gap) down. The server render therefore already sits on the
 * selected row, there is nothing to measure after hydration, and a `row` that changes with the
 * window (the sidebar's `shorter` step) moves it on its own. It spans the box's width.
 *
 * With nothing selected it fades out where it last was, instead of sweeping off somewhere;
 * `parked` remembers that row.
 */
export function SlidingHighlight({ index, row, gap, className }: SlidingHighlightProps) {
  const visible = index >= 0;
  const [parked, setParked] = useState(Math.max(index, 0));
  if (visible && index !== parked) setParked(index);

  const style: SlideStyle = {
    '--slide-index': visible ? index : parked,
    '--slide-row': row,
    '--slide-gap': gap,
  };

  return (
    <span
      aria-hidden
      data-highlight
      data-visible={visible}
      style={style}
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 h-(--slide-row) translate-y-[calc(var(--slide-index)*(var(--slide-row)+var(--slide-gap)))] transition-[translate,height,background-color,border-color,opacity] duration-base ease-standard',
        visible ? 'opacity-100' : 'opacity-0',
        className,
      )}
    />
  );
}
