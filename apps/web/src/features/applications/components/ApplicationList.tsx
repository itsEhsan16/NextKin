import type { ApplicationWithJob } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { ApplicationRow } from './ApplicationRow';

export type ApplicationListProps = {
  rows: ApplicationWithJob[];
  status: 'pending' | 'error' | 'success';
  /** Whether there are any applications at all, before the status pill and the filters narrow them. */
  hasAny: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onReset: () => void;
};

/**
 * The list, 12px between rows; `ApplicationsScreen` puts it in the page's one scroll container.
 * Every application arrives in one call, so unlike the job list there is nothing to page.
 */
export function ApplicationList({
  rows,
  status,
  hasAny,
  selectedId,
  onSelect,
  onRetry,
  onReset,
}: ApplicationListProps) {
  // Whatever replaces the skeleton fades in; a list already cached on arrival shows at once.
  const reveal = useReveal(status !== 'pending');

  if (status === 'pending') {
    return (
      <ul className="flex flex-col gap-4">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index}>
            <Skeleton className="h-[104px] rounded-lg" />
          </li>
        ))}
      </ul>
    );
  }

  if (status === 'error') {
    return (
      <StateView
        className={reveal ? 'animate-reveal' : undefined}
        tone="danger"
        title="Couldn't load your applications"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={onRetry}
      />
    );
  }

  if (!hasAny) {
    return (
      <StateView
        className={reveal ? 'animate-reveal' : undefined}
        title="No applications yet"
        message="Jobs you apply to show up here, so you can follow each one through."
      />
    );
  }

  if (rows.length === 0) {
    return (
      <StateView
        className={reveal ? 'animate-reveal' : undefined}
        title="No applications match"
        message="Try another status, or clear the filters."
        actionLabel="Reset filters"
        onAction={onReset}
      />
    );
  }

  return (
    <ul className={cn('flex flex-col gap-4', reveal && 'animate-rise')}>
      {rows.map((row) => (
        <li key={row.application.id}>
          <ApplicationRow
            row={row}
            selected={row.application.id === selectedId}
            onSelect={() => onSelect(row.application.id)}
          />
        </li>
      ))}
    </ul>
  );
}
