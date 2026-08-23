import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { Job } from '@/data/models';
import type { PlaceholderKey } from '@/features/placeholders';

/** Every tap target on the Jobs screen resolves here, keeping routing out of the components. */
export function useJobsActions() {
  const router = useRouter();

  const placeholder = useCallback(
    (screen: PlaceholderKey) =>
      router.push({ pathname: '/placeholder/[screen]', params: { screen } }),
    [router],
  );

  return useMemo(
    () => ({
      openNotifications: () => placeholder('notifications'),
      // JOBS 04 — Filters is designed but not yet implemented.
      openFilters: () => placeholder('job-filters'),
      openSort: () => placeholder('job-sort'),
      openLocationPicker: () => placeholder('job-location'),
      openJob: (_job: Job) => placeholder('job-detail'),
    }),
    [placeholder],
  );
}
