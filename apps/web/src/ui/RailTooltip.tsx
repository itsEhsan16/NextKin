'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { useState, type ReactNode } from 'react';

import { motion } from '@/theme/tokens';

export type RailTooltipProps = {
  /** The words the icon stands for. */
  label: string;
  /**
   * Whether the label is hidden, so the tooltip has something to add. Off, it never opens; the
   * tree stays the same either way, so the trigger isn't remounted when the sidebar collapses
   * and its own transitions keep running.
   */
  enabled: boolean;
  /** One focusable element, which becomes the trigger. */
  children: ReactNode;
};

/**
 * The collapsed rail's labels: an icon's name in a small popover that grows in beside it, on
 * hover or keyboard focus (`toreview.md` §84). It replaced the browser's own `title` tooltip,
 * which waited over a second, ignored focus and looked like nothing else in the app.
 *
 * Popover tokens (the menus' border, card fill and shadow); motion is `animate-pop-in` /
 * `animate-pop-out` from the side it opens on. Needs a `RailTooltipProvider` above it.
 */
export function RailTooltip({ label, enabled, children }: RailTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip.Root open={enabled && open} onOpenChange={setOpen}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={10}
          className="z-50 origin-(--radix-tooltip-content-transform-origin) rounded-md border border-border-default bg-surface-card px-2 py-1 text-caption-m text-text-primary shadow-popover data-[state=closed]:animate-pop-out data-[state=delayed-open]:animate-pop-in data-[state=instant-open]:animate-pop-in"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** Shares one delay across a group of `RailTooltip`s, so moving along them shows each at once. */
export function RailTooltipProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider delayDuration={motion.delays.tooltip}>{children}</Tooltip.Provider>;
}
