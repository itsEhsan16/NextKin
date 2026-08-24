import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Profile, ProfilePreferences } from '@/data/models';
import { repos } from '@/data/repos';

import { qk } from './keys';

export function useProfile() {
  return useQuery({
    queryKey: qk.profile.me(),
    queryFn: () => repos.profile.getProfile(),
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
 * simulated latency.
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<ProfilePreferences>) => repos.profile.updatePreferences(patch),
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.profile.all }),
  });
}
