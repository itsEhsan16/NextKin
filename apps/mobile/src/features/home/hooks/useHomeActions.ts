import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { Job, Resume } from '@/data/models';
import { useCreateSheet } from '@/navigation';

import type { QuickStartAction } from '../components/QuickStartCard';
import type { Shortcut } from '../components/ShortcutGrid';
import { useHomeStore } from '../homeStore';

/**
 * Where each card on the quick-start row goes (V2 §7.5, §7.9, §7.8). Written out rather than
 * derived: the actions are a designed set (Figma 1:38), and a route map that a rename could
 * silently repoint is not worth the lines it saves. Cover Letter opens its setup (COVER 01,
 * 644:2) on the most recent tailored resume; the Job row there changes it.
 */
const QUICK_START_ROUTES: Record<
  QuickStartAction,
  '/create/build' | '/create/cover-letter' | '/create/zero-resume' | '/create/ats-check'
> = {
  // Build Resume opens BUILD 01 again (owner, 2026-10-27, toreview §139): a resume built from the
  // profile for one job, through 01 → 02/03 → 04 → 04b → 04c → 05–07. Tailoring keeps §114's path.
  'build-resume': '/create/build',
  'cover-letter': '/create/cover-letter',
  'zero-resume': '/create/zero-resume',
  'ats-check': '/create/ats-check',
};

/** Every tap target on Home resolves here, so routing stays out of the presentational tree. */
export function useHomeActions() {
  const router = useRouter();
  const { open: openCreateSheet } = useCreateSheet();
  const openMenuSheet = useHomeStore((state) => state.openMenu);

  return useMemo(
    () => ({
      openNotifications: () => router.push('/notifications'),
      /** The hamburger sheet is hosted over the tab bar (HomeMenuHost), not pushed. */
      openMenu: openMenuSheet,
      findJobs: () => router.navigate('/(tabs)/jobs'),
      viewAllJobs: () => router.navigate('/(tabs)/jobs'),
      viewAllResumes: () => router.navigate('/(tabs)/resumes'),
      openJob: (job: Job) => router.push({ pathname: '/jobs/[id]', params: { id: job.id } }),
      openResume: (resume: Resume) =>
        router.push({ pathname: '/resumes/[id]', params: { id: resume.id } }),
      createResume: openCreateSheet,
      /** All four quick starts are real intakes now (Phases 9B and 9D). */
      quickStart: (action: QuickStartAction) => router.push(QUICK_START_ROUTES[action]),
      shortcut: (shortcut: Shortcut) => {
        switch (shortcut) {
          case 'my-resumes':
            router.navigate('/(tabs)/resumes');
            return;
          case 'saved-jobs':
            router.navigate({ pathname: '/(tabs)/jobs', params: { segment: 'saved' } });
            return;
          case 'history':
            router.push('/history');
            return;
          case 'interview-prep':
            router.push('/interview');
            return;
        }
      },
    }),
    [openCreateSheet, openMenuSheet, router],
  );
}
