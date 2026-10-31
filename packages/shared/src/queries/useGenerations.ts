import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Generation, GenerationInput } from '../models';
import { isGenerationTerminal } from '../models';
import { repos } from '../repos';

import { qk } from './keys';

/**
 * Seeds the two caches a progress screen reads. `detail` is what the screen itself renders, and
 * `active` is what Home's progress card reads — a run started here is the active run, so writing
 * only the detail would leave Home showing nothing until its next refetch.
 */
function seedGeneration(queryClient: QueryClient, generation: Generation): void {
  queryClient.setQueryData(qk.generations.detail(generation.id), generation);
  queryClient.setQueryData(qk.generations.active(), generation);
}

/** Everything a started or retried run moves before it finishes: quota, history, the library. */
function sweepStartEffects(queryClient: QueryClient): void {
  // §13.3's usage banner has to show the spend the moment the run is accepted, not when it lands.
  void queryClient.invalidateQueries({ queryKey: qk.user.subscription() });
  void queryClient.invalidateQueries({ queryKey: qk.user.activity() });
  // `appendStartActivity` also bumps `activitiesCount`, which Home renders beside the progress
  // card — without this the counter sits a run behind for the whole staleTime window.
  void queryClient.invalidateQueries({ queryKey: qk.user.dashboardStats() });
  // `start` creates the document the run will fill, so the library gains a row immediately.
  void queryClient.invalidateQueries({ queryKey: qk.resumes.all });
}

/**
 * Recent runs, newest first. History reads this for the ones that haven't finished, and fetches
 * it fresh every time: a run can end while nothing on this device is watching it.
 */
export function useGenerations() {
  return useQuery({
    queryKey: qk.generations.list(),
    queryFn: () => repos.generations.list(),
    staleTime: 0,
  });
}

/**
 * One run, watched on its own screen (V2 §7.6). While it is live this subscribes to progress
 * ticks and writes each one into both `detail` and `active`: Home's progress card reads the
 * active key, so a run being watched here has to keep that card in step rather than let it drift.
 */
export function useGeneration(id: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: qk.generations.detail(id),
    queryFn: () => repos.generations.get(id),
    enabled: id.length > 0,
  });

  // Null once the run is terminal. Collapsing the id and the non-terminal flag into one dep keys
  // the effect on both: a tick that only moves `progress` must not tear the ticker down and
  // start it again.
  const liveId = query.data && !isGenerationTerminal(query.data.status) ? query.data.id : null;

  useEffect(() => {
    if (!liveId) return undefined;
    return repos.generations.subscribe(liveId, (generation) => {
      queryClient.setQueryData(qk.generations.detail(liveId), generation);
      queryClient.setQueryData(qk.generations.active(), generation);
      if (isGenerationTerminal(generation.status)) {
        // The document is now filled and scored, the quota is spent, and History has a row.
        void queryClient.invalidateQueries({ queryKey: qk.resumes.all });
        void queryClient.invalidateQueries({
          queryKey: qk.user.subscription(),
        });
        void queryClient.invalidateQueries({ queryKey: qk.user.activity() });
        void queryClient.invalidateQueries({
          queryKey: qk.user.dashboardStats(),
        });
        // The whole aggregate, not just `active`: the tick that landed rewrote the row in the
        // store, so anything holding the list still shows a run as generating.
        void queryClient.invalidateQueries({ queryKey: qk.generations.all });
        // An interview run writes a practice set on completion (§7.15).
        void queryClient.invalidateQueries({ queryKey: qk.interview.all });
      }
    });
  }, [liveId, queryClient]);

  return query;
}

/**
 * Starts a run (V2 §7.6). Write-through rather than optimistic: the id comes from the server, so
 * there is nothing to render until it answers — but the moment it does, the screen this
 * navigates to must find the run already in cache instead of flashing a spinner.
 */
export function useStartGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerationInput) => repos.generations.start(input),
    onSuccess: (generation) => {
      seedGeneration(queryClient, generation);
      sweepStartEffects(queryClient);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.generations.all }),
  });
}

/**
 * Re-runs a failed generation against the same input (V2 §7.6). The run is back at `queued` with
 * its error cleared, so the same seeding puts the progress screen back on screen at once.
 */
export function useRetryGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repos.generations.retry(id),
    onSuccess: (generation) => {
      seedGeneration(queryClient, generation);
      sweepStartEffects(queryClient);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.generations.all }),
  });
}

/**
 * Stops a run before it finishes (ATS 02's Cancel). The allowance comes back and any document the
 * run opened goes, so the plan, the library and the run lists are refreshed with the run itself.
 */
export function useCancelGeneration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repos.generations.cancel(id),
    onSuccess: (generation) => {
      queryClient.setQueryData(qk.generations.detail(generation.id), generation);
      void queryClient.invalidateQueries({ queryKey: qk.generations.all });
      void queryClient.invalidateQueries({ queryKey: qk.user.subscription() });
      void queryClient.invalidateQueries({ queryKey: qk.resumes.all });
    },
  });
}
