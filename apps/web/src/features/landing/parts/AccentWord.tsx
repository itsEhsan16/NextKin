import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/** The one serif italic word per heading (Instrument Serif Italic, ~1.16× the line's size). */
export function AccentWord({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      data-lp-accent
      className={cn(
        'font-serif-accent text-[1.16em] font-normal tracking-[-0.01em] italic',
        className,
      )}
    >
      {children}
    </span>
  );
}
