import type { ReactNode } from 'react';

import type { AdminDelta } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { AdminIcon } from '@/ui/animated/AdminIcon';

import { formatDelta } from '../format';

export type AdminBadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

/** The admin boards' badge pairs: a 50 fill, the 600 ink, and a hairline of the ink at 30%. */
const TONE: Record<AdminBadgeTone, { box: string; dot: string }> = {
  neutral: { box: 'border-neutral-200 bg-neutral-50 text-neutral-700', dot: 'bg-neutral-700' },
  brand: { box: 'border-brand-100 bg-brand-50 text-brand-700', dot: 'bg-brand-700' },
  success: { box: 'border-success-600/30 bg-success-50 text-success-600', dot: 'bg-success-600' },
  warning: { box: 'border-warning-600/30 bg-warning-50 text-warning-600', dot: 'bg-warning-600' },
  danger: { box: 'border-danger-600/30 bg-danger-50 text-danger-600', dot: 'bg-danger-600' },
  info: { box: 'border-info-600/30 bg-info-50 text-info-600', dot: 'bg-info-600' },
};

export type AdminBadgeProps = {
  tone: AdminBadgeTone;
  /** A status dot before the label ("● Healthy"). */
  dot?: boolean;
  /** A leading glyph, e.g. the arrow of a change. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** A count, status or change, as every admin board draws one (Figma 382:936). */
export function AdminBadge({ tone, dot, icon, children, className }: AdminBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border py-0.5 text-caption-m',
        dot || icon ? 'pl-1.5 pr-2' : 'px-2',
        TONE[tone].box,
        className,
      )}
    >
      {dot && <span aria-hidden className={cn('size-1.5 rounded-full', TONE[tone].dot)} />}
      {icon}
      {children}
    </span>
  );
}

/** A change against the last window: green and up when it rose, red and down when it fell. */
export function DeltaBadge({ delta }: { delta: AdminDelta }) {
  const rose = delta.value >= 0;
  return (
    <AdminBadge
      tone={rose ? 'success' : 'danger'}
      icon={<AdminIcon name={rose ? 'ArrowUp' : 'ArrowDown'} size="xs" />}
    >
      <span className="sr-only">{rose ? 'Up ' : 'Down '}</span>
      {formatDelta(delta)}
    </AdminBadge>
  );
}

/**
 * A change in a count, written as the board writes it ("↑ 2,418" on Users' Total users card):
 * the caller formats the figure; the arrow and tone come from the direction.
 */
export function TrendBadge({ up, children }: { up: boolean; children: ReactNode }) {
  return (
    <AdminBadge
      tone={up ? 'success' : 'danger'}
      icon={<AdminIcon name={up ? 'ArrowUp' : 'ArrowDown'} size="xs" />}
    >
      <span className="sr-only">{up ? 'Up ' : 'Down '}</span>
      {children}
    </AdminBadge>
  );
}
