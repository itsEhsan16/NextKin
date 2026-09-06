import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { ActivityEntry } from '@/data/models';

/** Every tap target on the History screen resolves here. */
export function useHistoryActions() {
  const router = useRouter();

  return useMemo(
    () => ({
      goBack: () => router.back(),
      /**
       * A row opens its exact destination. `navigate` rather than `push`, the idiom the
       * notifications feed uses: a link at a tab root lands on the tab instead of stacking a copy
       * of it over the feed.
       */
      openEntry: (entry: ActivityEntry) => {
        if (!entry.deepLink) return;
        router.navigate(entry.deepLink as Parameters<typeof router.navigate>[0]);
      },
      /** The empty state's way forward: the loop starts with a job. */
      findJobs: () => router.navigate('/jobs'),
    }),
    [router],
  );
}
