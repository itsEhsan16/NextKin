import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { InfoCircle } from '@/ui/lineIcons';

import { buttonClass } from './Button';

/** Back, and a step's one primary: the two buttons every flow footer carries (849:313, 849:315). */
export const backButton = buttonClass({ variant: 'secondary', size: 'lg' });
export const primaryButton = buttonClass({ size: 'lg' });
/**
 * The flow's last commit (Apply, Download, Create): ink, not brand, so the end of a flow looks
 * different from the steps that lead to it (redesign R3d; Jobright §2.3's final step, adopted).
 */
export const finalButton = buttonClass({ variant: 'inverse', size: 'lg' });

/**
 * The bar under a flow step (849:138), promoted to a primitive (redesign R3d): what the press
 * costs or needs on the left (a `CreditPill`, a `TimeEstimateNote`, a reassurance), then Back and
 * the step's one primary on the right. It sticks to the bottom of the window on the glass panel.
 * A `danger` note is an alert, so it is read out when it appears.
 */
export function FlowFooter({
  note,
  noteTone = 'neutral',
  noteIcon = true,
  children,
}: {
  note?: ReactNode;
  /** Off when the note draws its own icon (a `CreditPill`). */
  noteIcon?: boolean;
  noteTone?: 'neutral' | 'danger';
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-4 z-sticky flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border-subtle bg-surface-glass-panel px-5 py-3 shadow-popover backdrop-blur-md">
      <div
        role={noteTone === 'danger' ? 'alert' : undefined}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 text-body-m font-medium',
          noteTone === 'danger' ? 'text-feedback-danger-text' : 'text-text-tertiary',
        )}
      >
        {note && noteIcon && (
          <InfoCircle aria-hidden className="size-4.5 shrink-0 text-text-disabled" />
        )}
        {note}
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}
