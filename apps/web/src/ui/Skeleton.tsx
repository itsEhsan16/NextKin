'use client';

import { cn } from '@/lib/cn';

/**
 * Starts every pulse on the document's own clock, so all the skeletons on screen breathe together
 * however late each one mounted (`toreview.md` §84). Each used to start its pulse when it
 * mounted, and a page's skeletons drifted out of step with one another.
 */
function syncPulse(element: HTMLElement | null) {
  if (!element?.getAnimations) return;
  for (const animation of element.getAnimations()) animation.startTime = 0;
}

export type SkeletonProps = {
  className?: string;
  /** `span` where the placeholder sits inside phrasing content (a label, a chip). */
  as?: 'div' | 'span';
};

/** Loading placeholder. Pulse is disabled under prefers-reduced-motion by the global rule. */
export function Skeleton({ className, as: Tag = 'div' }: SkeletonProps) {
  return (
    <Tag
      ref={syncPulse}
      className={cn(
        'block animate-shimmer rounded-md bg-neutral-200/70 bg-linear-to-r from-transparent via-neutral-0/70 to-transparent bg-size-[200%_100%] bg-no-repeat',
        className,
      )}
    />
  );
}
