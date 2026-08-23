import {
  type InfiniteData,
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import type { Job } from '@/data/models';
import { type Page, repos } from '@/data/repos';

import { qk } from './keys';

type JobPages = InfiniteData<Page<Job>, string | undefined>;

const toggle = (job: Job): Job => ({ ...job, isSaved: !job.isSaved });

/** Finds the job in any jobs cache so the saved list can be updated optimistically. */
function findCachedJob(queryClient: QueryClient, id: string): Job | undefined {
  const detail = queryClient.getQueryData<Job>(qk.jobs.detail(id));
  if (detail) return detail;
  for (const [, list] of queryClient.getQueriesData<Job[]>({ queryKey: qk.jobs.picks() })) {
    const hit = list?.find((job) => job.id === id);
    if (hit) return hit;
  }
  for (const [, pages] of queryClient.getQueriesData<JobPages>({ queryKey: qk.jobs.lists() })) {
    const hit = pages?.pages.flatMap((page) => page.items).find((job) => job.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** Applies a toggle to every jobs cache (detail, paged lists, picks, saved). */
export function applySaveToggle(queryClient: QueryClient, id: string): void {
  const cached = findCachedJob(queryClient, id);

  queryClient.setQueryData<Job>(qk.jobs.detail(id), (old) => (old ? toggle(old) : old));

  queryClient.setQueriesData<JobPages>({ queryKey: qk.jobs.lists() }, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((job) => (job.id === id ? toggle(job) : job)),
          })),
        }
      : old,
  );

  queryClient.setQueryData<Job[]>(qk.jobs.picks(), (old) =>
    old?.map((job) => (job.id === id ? toggle(job) : job)),
  );

  queryClient.setQueryData<Job[]>(qk.jobs.saved(), (old) => {
    if (!old) return old;
    const exists = old.some((job) => job.id === id);
    if (exists) return old.filter((job) => job.id !== id);
    return cached ? [{ ...cached, isSaved: true }, ...old] : old;
  });
}

/**
 * Optimistically flips `isSaved` across every jobs cache, rolls back on error,
 * and reconciles with the server response on success.
 */
export function useToggleSaveJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repos.jobs.toggleSave(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: qk.jobs.all });
      const snapshot = queryClient.getQueriesData<unknown>({ queryKey: qk.jobs.all });
      applySaveToggle(queryClient, id);
      return { snapshot };
    },
    onError: (_error, _id, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSuccess: (job) => {
      queryClient.setQueryData(qk.jobs.detail(job.id), job);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.jobs.all }),
  });
}
