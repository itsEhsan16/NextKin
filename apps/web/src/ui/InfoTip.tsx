'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { motion } from '@/theme/tokens';
import { InfoCircle } from '@/ui/lineIcons';

/**
 * ⓘ beside anything opinionated: a score, a credit, an AI term (redesign R3c; Jobright §1.5.5,
 * adopted). The explanation is there when asked for and out of the body copy otherwise. It opens on
 * hover and keyboard focus like a tooltip, and on a tap or click too, so touch users can read it.
 */
export function InfoTip({
  label,
  children,
  side = 'top',
  className,
}: {
  /** What the ⓘ is about, for screen readers: "How credits work". */
  label: string;
  /** The explanation. Keep it to a sentence or two. */
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip.Provider delayDuration={motion.delays.tooltip}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={label}
            onClick={() => setOpen((value) => !value)}
            className={cn(
              'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors duration-press ease-standard hover:text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring',
              className,
            )}
          >
            <InfoCircle aria-hidden className="size-4" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={6}
            collisionPadding={12}
            className="z-tooltip max-w-xs origin-(--radix-tooltip-content-transform-origin) rounded-md border border-border-default bg-surface-raised px-3 py-2 text-body-s text-text-secondary shadow-popover data-[state=closed]:animate-pop-out data-[state=delayed-open]:animate-pop-in data-[state=instant-open]:animate-pop-in"
          >
            {children}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
