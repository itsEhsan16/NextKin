import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { AlertTriangle, InfoCircle, Lightbulb02, iconSize } from './lineIcons';

export type CalloutTone = 'tip' | 'info' | 'warning';

const TONE: Record<CalloutTone, { box: string; icon: string; Icon: typeof InfoCircle }> = {
  tip: {
    box: 'bg-surface-brand-strong text-text-secondary',
    icon: 'text-text-brand',
    Icon: Lightbulb02,
  },
  info: {
    box: 'bg-surface-muted text-text-secondary',
    icon: 'text-text-tertiary',
    Icon: InfoCircle,
  },
  warning: {
    box: 'bg-warning-50 text-warning-text',
    icon: 'text-warning-text',
    Icon: AlertTriangle,
  },
};

/**
 * A short note in a flow (toreview §131): a tip, a fact worth knowing, a warning. One look per
 * tone, so the tips that each had their own tint and glyph read as one thing. Keep it to a line
 * or two; anything longer belongs in the page.
 */
export function Callout({
  tone = 'tip',
  children,
  className,
}: {
  tone?: CalloutTone;
  children: ReactNode;
  className?: string;
}) {
  const { box, icon, Icon } = TONE[tone];
  return (
    <div
      role={tone === 'warning' ? 'status' : undefined}
      className={cn(
        'flex items-start gap-2.5 rounded-md px-3.5 py-2.5 text-body-s',
        box,
        className,
      )}
    >
      <Icon aria-hidden className={cn(iconSize.sm, 'mt-px', icon)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
