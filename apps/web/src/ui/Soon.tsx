'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactElement } from 'react';

import { cn } from '@/lib/cn';
import { motion } from '@/theme/tokens';

/**
 * A control whose feature isn't built yet (`toreview.md` §85, "connect and label"): it reads as
 * unavailable and never presses or tints. Put it on the trigger together with
 * `aria-disabled="true"` and no click handler — the button helpers already skip their hover and
 * press under `aria-disabled`, so this only adds the dim and the resting cursor.
 *
 * `aria-disabled` rather than `disabled` on purpose: a disabled button swallows the pointer, and
 * its tooltip — the one place that says why — would never open.
 */
export const soonControl = 'aria-disabled:cursor-default aria-disabled:opacity-60';

export type SoonProps = {
  /** One focusable element (a button or a link), which becomes the tooltip's trigger. */
  children: ReactElement;
  /** What the tooltip says. */
  label?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
};

/**
 * "Coming soon", said where the reader is pointing: a small popover that grows in on hover or
 * keyboard focus after the rail tooltips' delay, styled like them. Before §85 about 35 controls
 * looked live and did nothing when pressed.
 */
export function Soon({ children, label = 'Coming soon', side = 'top' }: SoonProps) {
  return (
    <Tooltip.Provider delayDuration={motion.delays.tooltip}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={6}
            className="z-tooltip origin-(--radix-tooltip-content-transform-origin) rounded-md border border-border-default bg-surface-card px-2 py-1 text-caption-m text-text-primary shadow-popover data-[state=closed]:animate-pop-out data-[state=delayed-open]:animate-pop-in data-[state=instant-open]:animate-pop-in"
          >
            {label}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/**
 * The small "Soon" mark beside a link whose destination is still a placeholder page, so the
 * reader knows before clicking that they will land on a "coming soon" screen.
 */
export function SoonTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        // `text-secondary`, not tertiary: tertiary on this grey was 4.34:1, under AA (redesign R3c).
        'inline-flex shrink-0 items-center rounded-full bg-neutral-100 px-1.5 py-px text-micro font-semibold text-text-secondary',
        className,
      )}
    >
      Soon
    </span>
  );
}
