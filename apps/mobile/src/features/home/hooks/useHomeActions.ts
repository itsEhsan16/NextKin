import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import type { Job, Resume } from '@/data/models';
import { useRetryGeneration } from '@/data/queries';
import type { PlaceholderKey } from '@/features/placeholders';
import { useCreateSheet } from '@/navigation';

import type { QuickStartAction } from '../components/QuickStartCard';
import type { Shortcut } from '../components/ShortcutGrid';

/** Every tap target on Home resolves here, so routing stays out of the presentational tree. */
export function useHomeActions() {
  const router = useRouter();
  const { open: openCreateSheet } = useCreateSheet();
  // `mutate` is stable across renders, so the memo below survives the mutation's own state.
  const { mutate: retryGeneration } = useRetryGeneration();

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
      /**
       * "Build Resume" is the tailor flow (Phase 9B). The other three are still undesigned
       * destinations — 9D builds them — so they keep falling through to the placeholder, which is
       * why this is a switch rather than a straight pass-through.
       */
      quickStart: (action: QuickStartAction) => {
        if (action === 'build-resume') {
          router.push('/create/tailor');
          return;
        }
        placeholder(action);
      },
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
    [openCreateSheet, placeholder, retryGeneration, router],
  );
}
