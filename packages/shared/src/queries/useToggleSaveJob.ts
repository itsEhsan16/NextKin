import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';

import type { Job } from '../models';
import { repos } from '../repos';

import { findCachedJob, type JobPages } from './jobCache';
import { qk } from './keys';

/** The save a tap asks for: explicit, so a retried request can never flip it back (P11-04). */
export type SaveJobVariables = { id: string; saved: boolean };

const withSaved = (job: Job, saved: boolean): Job => {
  if (saved) return { ...job, isSaved: true, savedAt: job.savedAt ?? new Date().toISOString() };
  const { savedAt: _cleared, ...rest } = job;
  return { ...rest, isSaved: false };
};

const patchList =
  (id: string, saved: boolean) =>
  (old: Job[] | undefined): Job[] | undefined =>
    old?.map((job) => (job.id === id ? withSaved(job, saved) : job));

/** Applies a save to every jobs cache (detail, paged lists, picks, similar, company, saved). */
export function applySaveToggle(queryClient: QueryClient, id: string, saved: boolean): void {
  const cached = findCachedJob(queryClient, id);

  queryClient.setQueryData<Job>(qk.jobs.detail(id), (old) => (old ? withSaved(old, saved) : old));

  queryClient.setQueriesData<JobPages>({ queryKey: qk.jobs.lists() }, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((job) => (job.id === id ? withSaved(job, saved) : job)),
          })),
        }
      : old,
  );

  queryClient.setQueryData<Job[]>(qk.jobs.picks(), patchList(id, saved));
  queryClient.setQueryData<Job[]>(qk.jobs.todaysPicks(), patchList(id, saved));
  queryClient.setQueriesData<Job[]>({ queryKey: ['jobs', 'similar'] }, patchList(id, saved));
  queryClient.setQueriesData<Job[]>({ queryKey: ['jobs', 'by-company'] }, patchList(id, saved));

  queryClient.setQueryData<Job[]>(qk.jobs.saved(), (old) => {
    if (!old) return old;
    const exists = old.some((job) => job.id === id);
    if (!saved) return exists ? old.filter((job) => job.id !== id) : old;
    if (exists) return old;
    return cached ? [withSaved(cached, true), ...old] : old;
  });
}

/**
 * Saves or unsaves a job, optimistically across every jobs cache; rolls back on error (the Free
 * cap answers `PlanLockedError`, which the screen turns into the upsell) and reconciles with the
 * server's copy on success. Only the saved lists refetch afterwards: refetching every job query
 * on every tap would spend a provider's quota for nothing.
 */
export function useToggleSaveJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, saved }: SaveJobVariables) => repos.jobs.setSaved(id, saved),
    onMutate: async ({ id, saved }) => {
      await queryClient.cancelQueries({ queryKey: qk.jobs.all });
      const snapshot = queryClient.getQueriesData<unknown>({ queryKey: qk.jobs.all });
      applySaveToggle(queryClient, id, saved);
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSuccess: (job: Job) => {
      queryClient.setQueryData(qk.jobs.detail(job.id), job);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.jobs.savedAll() }),
  });
}
