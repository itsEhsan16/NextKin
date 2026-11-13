import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { AlertTriangle } from '@/ui/lineIcons';
import { buttonClass } from '@/ui/Button';

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

const actionClass = cn(buttonClass({ variant: 'secondary', size: 'md' }), 'mt-3');

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
        'flex animate-rise flex-col items-center justify-center gap-2 px-6 py-12 text-center',
        className,
      )}
    >
      {art ? (
        <div aria-hidden className="mb-3">
          {art}
        </div>
      ) : tone === 'danger' ? (
        // An error is marked as one, not drawn like an empty list (redesign R7d, audit SY-05).
        <span
          aria-hidden
          className="mb-2 flex size-10 items-center justify-center rounded-full bg-feedback-danger-surface text-feedback-danger-icon"
        >
          <AlertTriangle className="size-5" />
        </span>
      ) : null}
      <p className="text-title-l text-text-primary">{title}</p>
      {message && <p className="max-w-sm text-body-m text-text-secondary">{message}</p>}
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
