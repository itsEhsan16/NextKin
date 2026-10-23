'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';

export type RevealProps = {
  /** Whether the content's data has arrived. */
  ready: boolean;
  /** What stands in until it has: skeletons at the content's loaded heights. */
  fallback: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Skeleton until the data arrives, then the content fading in (`toreview.md` §84, §102): the
 * `useReveal` pattern in one place, so a screen can't forget the fade. Content already cached when
 * the screen mounted shows at once.
 */
export function Reveal({ ready, fallback, children, className }: RevealProps) {
  const reveal = useReveal(ready);
  if (!ready) return <>{fallback}</>;
  return <div className={cn(className, reveal && 'animate-reveal')}>{children}</div>;
}
