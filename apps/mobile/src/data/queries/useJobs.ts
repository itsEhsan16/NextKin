import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { EMPTY_JOB_FILTERS, type JobFilters, type JobSort } from '@/data/models';
import { repos } from '@/data/repos';

import { qk } from './keys';

/** Paged job search. Flatten with `data.pages.flatMap((page) => page.items)`. */
export function useJobs(filters: JobFilters = EMPTY_JOB_FILTERS, sort: JobSort = 'relevance') {
  return useInfiniteQuery({
    queryKey: qk.jobs.list(filters, sort),
    queryFn: ({ pageParam }) => repos.jobs.list(filters, pageParam, sort),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Filters and the search term are part of the key; keep showing the last results while the
    // next set loads so the list never blinks back to skeletons mid-typing.
    placeholderData: keepPreviousData,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: qk.jobs.detail(id),
    queryFn: () => repos.jobs.get(id),
    enabled: id.length > 0,
  });
}

export function useSavedJobs() {
  return useQuery({
    queryKey: qk.jobs.saved(),
    queryFn: () => repos.jobs.listSaved(),
  });
}

export function useApplications() {
  return useQuery({
    queryKey: qk.jobs.applications(),
    queryFn: () => repos.jobs.listApplications(),
  });
}

/** Jobs tab "Today's picks" carousel — editorial, distinct from Home's match-ranked picks. */
export function useTodaysPicks() {
  return useQuery({
    queryKey: qk.jobs.todaysPicks(),
    queryFn: () => repos.jobs.listTodaysPicks(),
  });
}

export function useJobPicks() {
  return useQuery({
    queryKey: qk.jobs.picks(),
    queryFn: () => repos.jobs.listPicks(),
  });
}
