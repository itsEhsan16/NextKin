import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { GapAnswer, Profile, ProfilePreferences } from '../models';
import { repos } from '../repos';

import { qk } from './keys';
import { refetchWhenQueueEmpty, writeQueue } from './writeQueue';

const PREFERENCES_QUEUE = 'profile-preferences';

export function useProfile() {
  return useQuery({
    queryKey: qk.profile.me(),
    queryFn: () => repos.profile.getProfile(),
  });
}

/** What the gap interview still has to ask (toreview §146.7). Answers move it, so it's kept fresh. */
export function useGapQuestions() {
  return useQuery({ queryKey: qk.profile.gaps(), queryFn: () => repos.profile.getGapQuestions(), staleTime: 0 });
}

/** An answer or a skip. The server sends back what's left, and the profile has moved with it. */
export function useAnswerGap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: GapAnswer }) => repos.profile.answerGap(id, answer),
    onSuccess: (left) => {
      queryClient.setQueryData(qk.profile.gaps(), left);
      void queryClient.invalidateQueries({ queryKey: qk.profile.me() });
    },
  });
}

export function useCompleteNextStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repos.profile.completeNextStep(id),
    onSuccess: (profile) => {
      queryClient.setQueryData(qk.profile.me(), profile);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.profile.all }),
  });
}

/**
 * Preference-picker writes (availability, minimum salary, language). Optimistic: a picker
 * closes on tap, so the row underneath must show the new value immediately, not after the
 * simulated latency. The writes queue (`writeQueue`): web Settings saves every tick, and two quick
 * ticks in one list each send the whole list, so the second must land after the first.
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<ProfilePreferences>) => repos.profile.updatePreferences(patch),
    ...writeQueue(PREFERENCES_QUEUE),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: qk.profile.me() });
      const previous = queryClient.getQueryData<Profile>(qk.profile.me());
      queryClient.setQueryData<Profile>(qk.profile.me(), (old) =>
        old ? { ...old, preferences: { ...old.preferences, ...patch } } : old,
      );
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(qk.profile.me(), context.previous);
    },
    onSettled: () => {
      // Picks are chosen against these preferences.
      void queryClient.invalidateQueries({ queryKey: qk.jobs.picks() });
      return refetchWhenQueueEmpty(queryClient, PREFERENCES_QUEUE, qk.profile.all);
    },
  });
}
