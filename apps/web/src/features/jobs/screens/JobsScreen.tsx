'use client';

import { EMPTY_JOB_FILTERS, type Job, type JobFilters, type JobSort } from '@nextkin/shared/models';
import {
  queryPhase,
  useApplications,
  useApplyToJob,
  useCurrentUser,
  useJobCatalogue,
  useJobCount,
  useJobs,
  useJob,
} from '@nextkin/shared/queries';
import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { PageHeader } from '@/navigation/PageHeader';
import { pageFillInBar, pageFillMin, pageFrameInBar } from '@/ui/pageFrame';
import { ResultsBar } from '@/ui/ResultsBar';
import { StateView } from '@/ui/StateView';

import { applicationHref } from '@/features/applications/applicationHref';
import { JobDetailPanel } from '../components/JobDetailPanel';
import { JobFilterChipsRow } from '../components/JobFilterChipsRow';
import { JobList } from '../components/JobList';
import { JobSeekerIllustration } from '../components/JobSeekerIllustration';
import { JobsSearchBar } from '../components/JobsSearchBar';
import { useSaveJob } from '../hooks/useSaveJob';
import { WEB_JOB_SORT_LABEL } from '../jobSort';

const NO_JOBS: Job[] = [];

export type JobsScreenProps = {
  /**
   * A job to open on arrival: `/jobs?job=<id>`, which is how an application's "View Job" lands
   * here. It stays open even when the list doesn't hold it (a closed listing, or one on a later
   * page) until the user picks a job or changes what the list shows.
   */
  initialJobId?: string;
};

/**
 * "02 · Jobs" (304:2332) — a master-detail layout: the filtered/searched/paginated list and a
 * detail card for whichever job is selected, in the board's 56:44 split. At the compact density
 * (`toreview.md` §16) rather than the board's raw pixels, and fluid rather than a fixed 660/511,
 * so it holds from 1024 up: below 1280 the sidebar is the rail (`toreview.md` §84).
 *
 * The page never scrolls — it is exactly the window's height under the top bar. The header, the
 * search bar, the filter chips and the results bar stay put, and the job list is the one list that
 * scrolls. The detail card stays in place too, at its natural height, and scrolls as a whole only
 * when a job's details are taller than the window.
 *
 * Selection lives in local `useState`, not a URL param — see `toreview.md` §15.1 for why. The
 * one way in from a URL is `?job=`, which `JobsRoute` reads and hands over as `initialJobId`.
 */
export function JobsScreen({ initialJobId }: JobsScreenProps) {
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<JobFilters>(EMPTY_JOB_FILTERS);
  const [sort, setSort] = useState<JobSort>('relevance');
  const [selectedId, setSelectedId] = useState<string | undefined>(initialJobId);
  const [pinnedId, setPinnedId] = useState<string | undefined>(initialJobId);
  const unpin = () => setPinnedId(undefined);

  // Search is part of the same filters object as everything else, not a separate query key —
  // debounced here first so typing doesn't mint a new key per keystroke. The salary sliders are
  // too: a drag passes through every step, and each one used to fetch a list and a count.
  const debounced = useDebouncedValue(searchInput);
  const salaryMin = useDebouncedValue(filters.salaryMin);
  const salaryMax = useDebouncedValue(filters.salaryMax);
  const effectiveFilters = useMemo<JobFilters>(
    () => ({ ...filters, salaryMin, salaryMax, query: debounced || undefined }),
    [filters, salaryMin, salaryMax, debounced],
  );

  // A new result set starts at its top, not wherever the last one was scrolled to.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = 0;
  }, [effectiveFilters, sort]);

  const user = useCurrentUser();
  const applications = useApplications();
  const save = useSaveJob();
  const applyMutation = useApplyToJob();

  const jobsQuery = useJobs(effectiveFilters, sort);
  const countQuery = useJobCount(effectiveFilters);
  const jobs = useMemo(
    () => jobsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [jobsQuery.data],
  );
  // Data first: a failed background refresh leaves the list on screen (`toreview.md` §84).
  const listStatus = queryPhase(jobsQuery);

  // Options for the Location/Company chips need the *whole* catalogue, not the filtered result —
  // the fixture set is small (two pages over `JOBS_PAGE_SIZE`), so reading it up front is cheap
  // and avoids a dedicated "distinct values" repo method for one UI need. Its own cache entry, so
  // it never pages the visible list along with it.
  const allJobs = useJobCatalogue().data ?? NO_JOBS;

  // The job actually shown never needs an effect to "sync" it — it's a plain derivation from the
  // current list and whatever the user last clicked. `selectedId` only holds an explicit pick;
  // when there isn't one, or a filter change dropped it out of the visible list, this falls back
  // to the list's own first result during render, not via a setState-in-effect cascade. A pinned
  // deep link wins over all of that until the user does something.
  const activeId =
    pinnedId ??
    (listStatus === 'success'
      ? selectedId && jobs.some((job) => job.id === selectedId)
        ? selectedId
        : jobs[0]?.id
      : selectedId);

  // Opens on the list's own copy of the job, so picking one paints its details at once instead of
  // a skeleton. Until the list arrives there is nothing to pick, and the card waits as a skeleton
  // rather than saying "Select a job" for a moment.
  const detailQuery = useJob(activeId ?? '', { seedFromLists: true });
  const detailStatus = activeId
    ? queryPhase(detailQuery)
    : listStatus === 'pending'
      ? 'pending'
      : 'empty';
  const selectedJob = detailQuery.data;

  const application = selectedJob
    ? applications.data?.find((entry) => entry.application.jobId === selectedJob.id)?.application
    : undefined;
  const alreadyApplied = application != null;
  const justApplied = applyMutation.isSuccess && applyMutation.variables === selectedJob?.id;

  if (queryPhase(user) === 'error') {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          tone="danger"
          title="Something went wrong"
          message="We couldn't load your dashboard. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void user.refetch()}
        />
      </div>
    );
  }

  return (
    <div className={cn(pageFrameInBar, pageFillInBar, 'flex flex-col')}>
      <PageHeader
        title="Find the right opportunities"
        subtitle="Discover jobs that match your skills and career goals."
      />

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[56fr_44fr] gap-6">
        <div className="relative flex min-h-0 min-w-0 flex-col gap-3">
          {/* The board's character at three quarters: its skyline behind the search bar's right
              end, the figure in the gap before the detail card, the caption just above that
              card. Painted first, so the search bar and the detail card cover what they cover
              on the board. The search bar is 80% of this column, hence the anchor. */}
          <JobSeekerIllustration className="absolute -top-[50px] left-[calc(80%-61px)] origin-top-left scale-75" />

          <JobsSearchBar
            value={searchInput}
            onChange={(value) => {
              unpin();
              setSearchInput(value);
            }}
          />
          <JobFilterChipsRow
            filters={filters}
            onChange={(patch) => {
              unpin();
              setFilters((current) => ({ ...current, ...patch }));
            }}
            allJobs={allJobs}
          />
          <ResultsBar
            count={countQuery.data}
            loading={countQuery.isPending}
            noun={{ one: 'result', other: 'results' }}
            sort={sort}
            sortOptions={WEB_JOB_SORT_LABEL}
            onSortChange={(next) => {
              unpin();
              setSort(next);
            }}
          />

          {/* The page's one scroller, 8px wider than the column either side so the selected
              card's ring and shadow aren't clipped. */}
          <div
            ref={scrollerRef}
            className="-mx-2 -mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-5 pt-1 [scrollbar-width:thin]"
          >
            <JobList
              jobs={jobs}
              status={listStatus}
              selectedId={activeId}
              onSelect={(id) => {
                unpin();
                setSelectedId(id);
              }}
              onToggleSave={(id) => {
                const job = jobs.find((item) => item.id === id);
                if (job) save.toggle(job);
              }}
              savingId={save.savingId}
              hasNextPage={jobsQuery.hasNextPage ?? false}
              isFetchingNextPage={jobsQuery.isFetchingNextPage}
              onLoadMore={() => void jobsQuery.fetchNextPage()}
              onRetry={() => void jobsQuery.refetch()}
            />
          </div>
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-col pb-5">
          <JobDetailPanel
            job={selectedJob}
            status={detailStatus}
            onRetry={() => void detailQuery.refetch()}
            onApply={() => selectedJob && applyMutation.mutate(selectedJob.id)}
            applying={applyMutation.isPending && applyMutation.variables === selectedJob?.id}
            applied={alreadyApplied || justApplied}
            applicationHref={application ? applicationHref(application.id) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
