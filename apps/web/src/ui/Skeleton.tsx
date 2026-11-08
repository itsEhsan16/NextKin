'use client';

import type { CSSProperties } from 'react';

import { cn } from '@/lib/cn';

/**
 * Starts every skeleton's sweep on the document's own clock (`toreview.md` §84), so the band sits
 * at the same place in every block however late each one mounted — with the band laid out against
 * the window (§196), that is what makes the blocks read as one lit surface. Only the sweep: the
 * fade-in keeps its own start, or its delay would already have passed.
 */
function syncSweep(element: HTMLElement | null) {
  if (!element?.getAnimations) return;
  for (const animation of element.getAnimations()) {
    if ((animation as CSSAnimation).animationName === 'skeleton-sweep') animation.startTime = 0;
  }
}

export type SkeletonProps = {
  className?: string;
  /** For a size only known at run time (a block standing for N lines). */
  style?: CSSProperties;
  /** `span` where the placeholder sits inside phrasing content (a label, a chip). */
  as?: 'div' | 'span';
};

/**
 * Loading placeholder (§196): a soft shape with one diagonal light crossing the window (the
 * `skeleton` utility in theme.css). It waits a beat before it shows and leaves at once, so it
 * never flashes for a quick load nor sits over the content that replaces it.
 *
 * Use few, large shapes that trace the loaded layout — see `SkeletonShapes` — and never put one
 * inside a bordered or shadowed card: the frame makes it read as a box (use `Card`'s `loading`).
 */
export function Skeleton({ className, style, as: Tag = 'div' }: SkeletonProps) {
  return (
    <Tag
      ref={syncSweep}
      aria-hidden
      style={style}
      className={cn('skeleton rounded-md', className)}
    />
  );
}
