import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { Job, Resume } from '@/data/models';
import { useRetryGeneration } from '@/data/queries';
import { useCreateSheet } from '@/navigation';

import type { QuickStartAction } from '../components/QuickStartCard';
import type { Shortcut } from '../components/ShortcutGrid';
import { useHomeStore } from '../homeStore';

/**
 * Where each card on the quick-start row goes (V2 §7.5, §7.9, §7.10, §7.8). Written out rather
 * than derived: the four actions are a designed set (Figma 1:38), and a route map that a rename
 * could silently repoint is not worth the four lines it saves.
 */
const QUICK_START_ROUTES: Record<
  QuickStartAction,
  '/create/tailor' | '/create/zero-resume' | '/create/cover-letter' | '/create/ats-check'
> = {
  'build-resume': '/create/tailor',
  'zero-resume': '/create/zero-resume',
  'cover-letter': '/create/cover-letter',
  'ats-check': '/create/ats-check',
};

/** Every tap target on Home resolves here, so routing stays out of the presentational tree. */
export function useHomeActions() {
  const router = useRouter();
  const { open: openCreateSheet } = useCreateSheet();
  // `mutate` is stable across renders, so the memo below survives the mutation's own state.
  const { mutate: retryGeneration } = useRetryGeneration();
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
      /** The live run's own screen (V2 §7.6) — the progress card is a summary of it. */
      openGeneration: (generationId: string) =>
        router.push({ pathname: '/generations/[id]', params: { id: generationId } }),
      /**
       * Re-queues a failed run and follows it: the mock ticker only advances while something is
       * subscribed, and the progress screen is what subscribes — so retrying without going there
       * would leave the run sitting at `queued` for ever.
       */
      retryGeneration: (generationId: string) => {
        // Navigate from the callback, not beside the call: the mutation's onSuccess seeds the
        // detail cache with the re-queued run, and pushing first races the destination's own
        // fetch — which would paint the failure this tap was meant to clear.
        retryGeneration(generationId, {
          onSuccess: () =>
            router.push({ pathname: '/generations/[id]', params: { id: generationId } }),
        });
      },
      /** All four quick starts are real intakes now (Phases 9B and 9D). */
      quickStart: (action: QuickStartAction) => {
        router.push(QUICK_START_ROUTES[action]);
      },
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
          case 'ai-assistant':
            router.push('/assistant');
            return;
        }
      },
    }),
    [openCreateSheet, openMenuSheet, retryGeneration, router],
  );
}
