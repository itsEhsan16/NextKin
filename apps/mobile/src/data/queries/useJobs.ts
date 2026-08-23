import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { EMPTY_JOB_FILTERS, type JobFilters } from '@/data/models';
import { repos } from '@/data/repos';

import { qk } from './keys';

/** Paged job search. Flatten with `data.pages.flatMap((page) => page.items)`. */
export function useJobs(filters: JobFilters = EMPTY_JOB_FILTERS) {
  return useInfiniteQuery({
    queryKey: qk.jobs.list(filters),
    queryFn: ({ pageParam }) => repos.jobs.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
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

export function useJobPicks() {
  return useQuery({
    queryKey: qk.jobs.picks(),
    queryFn: () => repos.jobs.listPicks(),
  });
}
