'use client';

import { cn } from '@/lib/cn';
import { CheckCircle } from '@/ui/lineIcons';

import type { SaveStatus } from '../useAutosave';

/**
 * Where the work stands (toreview §124), as a pill, announced politely to a screen reader:
 * saved (with the time, so it can be trusted), saving, waiting to save, retrying, or not saved.
 */

const COPY: Record<SaveStatus, string> = {
  saved: 'All changes saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  retrying: 'Offline — retrying',
  conflict: 'Not saved: changed elsewhere',
  failed: 'Not saved',
};

const TONE: Record<SaveStatus, string> = {
  saved: 'bg-success-surface text-success-text',
  unsaved: 'bg-neutral-100 text-text-secondary',
  saving: 'bg-surface-brand text-text-brand',
  retrying: 'bg-warning-50 text-warning-text',
  conflict: 'bg-danger-50 text-danger-text',
  failed: 'bg-danger-50 text-danger-text',
};

const time = (at: Date) =>
  `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;

export function SaveIndicator({
  status,
  savedAt,
  onRetry,
}: {
  status: SaveStatus;
  savedAt: Date | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <p
        role="status"
        aria-live="polite"
        className={cn(
          'inline-flex h-6 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-caption-m font-semibold transition-colors duration-base ease-standard',
          TONE[status],
        )}
      >
        {status === 'saved' ? (
          <CheckCircle aria-hidden className="size-4.5 shrink-0" />
        ) : (
          <span
            aria-hidden
            className={cn(
              'size-1.5 shrink-0 rounded-full bg-current',
              status === 'saving' && 'animate-pulse',
            )}
          />
        )}
        <span className="truncate">
          {COPY[status]}
          {status === 'saved' && savedAt ? ` · ${time(savedAt)}` : ''}
        </span>
      </p>
      {(status === 'retrying' || status === 'failed') && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-sm px-1 text-caption-m font-semibold text-text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          Retry now
        </button>
      )}
    </div>
  );
}
