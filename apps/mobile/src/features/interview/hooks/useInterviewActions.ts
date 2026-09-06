import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import type { UpgradeReason } from '@/features/billing';

/** Every navigation the interview screens make (V2 §7.15). */
export function useInterviewActions() {
  const router = useRouter();

  return useMemo(
    () => ({
      goBack: () => router.back(),
      openLibrary: () => router.navigate('/interview'),
      openNew: (resumeId?: string) =>
        router.push(
          resumeId ? { pathname: '/interview/new', params: { resumeId } } : '/interview/new',
        ),
      openSet: (id: string) => router.push({ pathname: '/interview/[id]', params: { id } }),
      /**
       * Replace, not push: a run is already spending its quota by the time this fires, so leaving
       * the setup form on the stack would let a back-swipe start a second one.
       */
      openGeneration: (id: string) =>
        router.replace({ pathname: '/generations/[id]', params: { id } }),
      /** §13.5: the upsell names the limit it hit. */
      openUpgrade: (reason: UpgradeReason = 'interview') =>
        router.push({ pathname: '/upgrade', params: { reason } }),
      /** The empty library's honest way forward when there is no resume to write from either. */
      openUpload: () => router.push('/create/upload'),
    }),
    [router],
  );
}
