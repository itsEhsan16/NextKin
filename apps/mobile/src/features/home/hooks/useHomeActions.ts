import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { Job, Resume } from '@/data/models';
import type { PlaceholderKey } from '@/features/placeholders';
import { useCreateSheet } from '@/navigation';

import type { QuickStartAction } from '../components/QuickStartCard';
import type { Shortcut } from '../components/ShortcutGrid';

/** Every tap target on Home resolves here, so routing stays out of the presentational tree. */
export function useHomeActions() {
  const router = useRouter();
  const { open: openCreateSheet } = useCreateSheet();

  const placeholder = useCallback(
    (screen: PlaceholderKey) => router.push({ pathname: '/placeholder/[screen]', params: { screen } }),
    [router],
  );

  return useMemo(
    () => ({
      openNotifications: () => router.push('/notifications'),
      openMenu: () => placeholder('menu'),
      findJobs: () => router.navigate('/(tabs)/jobs'),
      viewAllJobs: () => router.navigate('/(tabs)/jobs'),
      viewAllResumes: () => router.navigate('/(tabs)/resumes'),
      openJob: (job: Job) => router.push({ pathname: '/jobs/[id]', params: { id: job.id } }),
      openResume: (_resume: Resume) => placeholder('resume-detail'),
      createResume: openCreateSheet,
      quickStart: (action: QuickStartAction) => placeholder(action),
      shortcut: (shortcut: Shortcut) => {
        switch (shortcut) {
          case 'my-resumes':
            router.navigate('/(tabs)/resumes');
            return;
          case 'saved-jobs':
            router.navigate({ pathname: '/(tabs)/jobs', params: { segment: 'saved' } });
            return;
          default:
            placeholder(shortcut);
        }
      },
    }),
    [openCreateSheet, placeholder, router],
  );
}
