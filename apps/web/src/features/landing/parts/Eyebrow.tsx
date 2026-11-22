import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Section eyebrow pill (e.g. 525:413): an icon chip and a short label. `tone="onViolet"` is the
 * translucent white of the hero and the indigo proof band; `tone="light"` sits on white.
 */
export function Eyebrow({
  icon,
  children,
  tone = 'light',
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: 'light' | 'onViolet';
  className?: string;
}) {
  return (
    <div
      data-lp-eyebrow
      className={cn(
        'inline-flex items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5 text-lp-eyebrow font-semibold',
        tone === 'onViolet'
          ? 'border-lp-white/35 bg-lp-white/18 text-lp-white'
          : 'border-lp-violet-line bg-lp-violet-soft text-lp-violet',
        !icon && 'pl-4',
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            // shrink-0: a long label on a phone squeezed the round chip into an oval (2026-11-22).
            'flex size-7 shrink-0 items-center justify-center rounded-full',
            tone === 'onViolet' ? 'bg-lp-white/25' : 'bg-lp-white',
          )}
        >
          {icon}
        </span>
      ) : null}
      {/* On the narrowest phones the label ends in an ellipsis rather than pushing the pill wide. */}
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}
