import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

/**
 * How many jobs a filter set would return. Drives the filter sheet's "Show N jobs" CTA, which
 * previews a draft the user has not applied yet — so it keeps the last count on screen rather
 * than blanking the button while the next one resolves.
 */
export function useJobCount(filters: JobFilters) {
  return useQuery({
    queryKey: qk.jobs.count(filters),
    queryFn: () => repos.jobs.count(filters),
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

/** "Similar jobs" on the detail screen. */
export function useSimilarJobs(id: string) {
  return useQuery({
    queryKey: qk.jobs.similar(id),
    queryFn: () => repos.jobs.listSimilar(id),
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

/** "Apply now" → the Applied tab gains the row (NOTIF 07's post-apply flow). */
export function useApplyToJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repos.jobs.apply(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.jobs.applications() }),
  });
}
