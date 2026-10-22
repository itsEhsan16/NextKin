import type { Job } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { JobCard } from './JobCard';
import { StableLabel } from '@/ui/StableLabel';

export type JobListProps = {
  jobs: Job[];
  status: 'pending' | 'error' | 'success';
  selectedId?: string;
  onSelect: (id: string) => void;
  onToggleSave: (id: string) => void;
  savingId?: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
};

/**
 * The job list, 12px between cards. `JobsScreen` puts it in the page's only scroll container.
 * Pagination has no equivalent drawn on the board (only 5 of "124 results" fit, with no page
 * numbers or infinite-scroll affordance) — mobile's `onEndReached` has no clean web analogue
 * here, so a "Load more" button is the pragmatic substitute: existing primitives, no new visual
 * language, per the project's rule for undesigned flows.
 */
export function JobList({
  jobs,
  status,
  selectedId,
  onSelect,
  onToggleSave,
  savingId,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRetry,
}: JobListProps) {
  // Whatever replaces the skeleton fades in; a list already cached on arrival shows at once.
  const reveal = useReveal(status !== 'pending');

  if (status === 'pending') {
    return (
      <ul className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index}>
            {/* A card with a match reason, as most are (`JobCard`). */}
            <Skeleton className="h-[255px] rounded-xl" />
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
        title="Couldn't load jobs"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={onRetry}
      />
    );
  }

  if (jobs.length === 0) {
    return (
      <StateView
        className={reveal ? 'animate-reveal' : undefined}
        title="No jobs match your filters"
        message="Try widening your search or clearing a filter."
      />
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', reveal && 'animate-reveal')}>
      <ul className="flex flex-col gap-3">
        {jobs.map((job) => (
          <li key={job.id}>
            <JobCard
              job={job}
              selected={job.id === selectedId}
              onSelect={() => onSelect(job.id)}
              onToggleSave={() => onToggleSave(job.id)}
              savePending={job.id === savingId}
            />
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
          className="h-control-md rounded-md border border-border-divider text-body-s font-semibold text-text-primary transition-colors duration-press ease-standard hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
        >
          <StableLabel label="Load more" busyLabel="Loading…" busy={isFetchingNextPage} />
        </button>
      )}
    </div>
  );
}
