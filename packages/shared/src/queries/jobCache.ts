import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { Job } from '../models';
import type { Page } from '../repos';

import { qk } from './keys';

export type JobPages = InfiniteData<Page<Job>, string | undefined>;

/**
 * Finds a job in any jobs cache: its detail entry, Today's picks, a loaded search page, or the
 * saved list. Used to update the saved list optimistically, and to open a job's detail screen on
 * the copy its list already holds instead of a skeleton.
 */
export function findCachedJob(queryClient: QueryClient, id: string): Job | undefined {
  const detail = queryClient.getQueryData<Job>(qk.jobs.detail(id));
  if (detail) return detail;
  for (const key of [qk.jobs.picks(), qk.jobs.todaysPicks()]) {
    for (const [, list] of queryClient.getQueriesData<Job[]>({ queryKey: key })) {
      const hit = list?.find((job) => job.id === id);
      if (hit) return hit;
    }
  }
  for (const [, pages] of queryClient.getQueriesData<JobPages>({
    queryKey: qk.jobs.lists(),
  })) {
    const hit = pages?.pages.flatMap((page) => page.items).find((job) => job.id === id);
    if (hit) return hit;
  }
  return queryClient.getQueryData<Job[]>(qk.jobs.saved())?.find((job) => job.id === id);
}
