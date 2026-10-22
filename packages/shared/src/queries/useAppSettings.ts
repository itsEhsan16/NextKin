import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AppSettings } from '../models';
import { repos } from '../repos';

import { qk } from './keys';
import { refetchWhenQueueEmpty, rollBackPatch, writeQueue } from './writeQueue';

const APP_SETTINGS_QUEUE = 'app-settings';

/** How the app looks and behaves for this account (web Settings → Preferences, Figma 356:85). */
export function useAppSettings() {
  return useQuery({
    queryKey: qk.user.appSettings(),
    queryFn: () => repos.user.getAppSettings(),
  });
}

/**
 * One setting at a time, optimistic: each control saves the moment it changes, so it must show
 * the new value straight away rather than after the simulated latency. The writes queue
 * (`writeQueue`), so two quick changes land in the order they were made and neither flips back,
 * and a failed one puts back only the setting it changed.
 */
export function useUpdateAppSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AppSettings>) => repos.user.updateAppSettings(patch),
    ...writeQueue(APP_SETTINGS_QUEUE),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: qk.user.appSettings() });
      const previous = queryClient.getQueryData<AppSettings>(qk.user.appSettings());
      queryClient.setQueryData<AppSettings>(qk.user.appSettings(), (old) =>
        old ? { ...old, ...patch } : old,
      );
      return { previous };
    },
    onError: (_error, patch, context) =>
      rollBackPatch(queryClient, qk.user.appSettings(), patch, context?.previous),
    onSettled: () => refetchWhenQueueEmpty(queryClient, APP_SETTINGS_QUEUE, qk.user.appSettings()),
  });
}
