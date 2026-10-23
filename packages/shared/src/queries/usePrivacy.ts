import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PrivacySettings } from '../models';
import { repos } from '../repos';

import { qk } from './keys';
import { refetchWhenQueueEmpty, rollBackPatch, writeQueue } from './writeQueue';

const PRIVACY_QUEUE = 'privacy-settings';

/** Who can see the profile, and the analytics opt-out (web Settings → Privacy & data). */
export function usePrivacySettings() {
  return useQuery({
    queryKey: qk.user.privacySettings(),
    queryFn: () => repos.user.getPrivacySettings(),
  });
}

/**
 * One setting at a time, optimistic: each control saves the moment it changes and shows the new
 * value straight away. The writes queue (`writeQueue`), so quick changes land in the order they
 * were made and none flips back, and a failed one puts back only the setting it changed.
 */
export function useUpdatePrivacySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<PrivacySettings>) => repos.user.updatePrivacySettings(patch),
    ...writeQueue(PRIVACY_QUEUE),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: qk.user.privacySettings() });
      const previous = queryClient.getQueryData<PrivacySettings>(qk.user.privacySettings());
      queryClient.setQueryData<PrivacySettings>(qk.user.privacySettings(), (old) =>
        old ? { ...old, ...patch } : old,
      );
      return { previous };
    },
    onError: (_error, patch, context) =>
      rollBackPatch(queryClient, qk.user.privacySettings(), patch, context?.previous),
    onSettled: () => refetchWhenQueueEmpty(queryClient, PRIVACY_QUEUE, qk.user.privacySettings()),
  });
}
