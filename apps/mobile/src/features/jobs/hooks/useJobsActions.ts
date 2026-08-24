import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { Job } from '@/data/models';
import type { PlaceholderKey } from '@/features/placeholders';

import { useJobsStore } from '../jobsStore';

/** Every tap target on the Jobs screen resolves here, keeping routing out of the components. */
export function useJobsActions() {
  const router = useRouter();
  // The sheet is hosted above the tab bar in the tabs layout, so opening it is a store write
  // rather than a navigation (Figma JOBS 04).
  const openFilters = useJobsStore((state) => state.openFilters);

  const placeholder = useCallback(
    (screen: PlaceholderKey) =>
      router.push({ pathname: '/placeholder/[screen]', params: { screen } }),
    [router],
  );

  return useMemo(
    () => ({
      openNotifications: () => router.push('/notifications'),
      openFilters,
      openSort: () => placeholder('job-sort'),
      openLocationPicker: () => placeholder('job-location'),
      openJob: (job: Job) => router.push({ pathname: '/jobs/[id]', params: { id: job.id } }),
      viewAllJobs: () => router.navigate('/(tabs)/jobs'),
      goBack: () => router.back(),
      // Designed flows that JOBS 05 links out to but Figma has not drawn yet.
      shareJob: () => placeholder('job-share'),
      openCompany: (_job: Job) => placeholder('company-profile'),
      openFullCriteria: () => placeholder('match-criteria'),
      tailorResume: () => placeholder('tailor-to-a-job'),
    }),
    [openFilters, placeholder, router],
  );
}
