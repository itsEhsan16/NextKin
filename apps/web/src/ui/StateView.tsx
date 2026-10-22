import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type StateViewProps = {
  title: string;
  message?: string;
  /**
   * An illustration above the title, for an empty state that should feel intended rather than
   * unfinished (`toreview.md` §85). Decorative: the title says everything it shows.
   */
  art?: ReactNode;
  actionLabel?: string;
  /** The action as a button. */
  onAction?: () => void;
  /** The action as a link — an empty list's way onward ("Find jobs"). */
  actionHref?: Route;
  tone?: 'neutral' | 'danger';
  className?: string;
};

const actionClass =
  'mt-1 rounded-sm px-3 py-1.5 text-body-s font-semibold text-text-brand transition-colors duration-press ease-standard hover:bg-surface-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

/**
 * The empty and error surface, one component so every screen's fourth and third states look the
 * same — the web counterpart of `apps/mobile/src/ui/StateView`.
 *
 * It fades in (`animate-reveal`): a state only ever mounts when it replaces something — a
 * skeleton, a list that just emptied — so the change reads as an arrival, not a cut (§85).
 */
export function StateView({
  title,
  message,
  art,
  actionLabel,
  onAction,
  actionHref,
  tone = 'neutral',
  className,
}: StateViewProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn(
        'flex animate-reveal flex-col items-center justify-center gap-1.5 px-6 py-8 text-center',
        className,
      )}
    >
      {art && (
        <div aria-hidden className="mb-2.5">
          {art}
        </div>
      )}
      <p className="text-title-l text-text-primary">{title}</p>
      {message && <p className="max-w-sm text-body-s text-text-secondary">{message}</p>}
      {actionLabel && actionHref ? (
        <Link href={actionHref} className={actionClass}>
          {actionLabel}
        </Link>
      ) : actionLabel && onAction ? (
        <button type="button" onClick={onAction} className={actionClass}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
