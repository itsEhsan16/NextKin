import { useRouter } from 'expo-router';
import { useMemo } from 'react';

/**
 * Routing for the JD review step (V2 §7.5 → §7.6).
 *
 * Screen-scoped rather than folded into `useCreateActions`: the two were written side by side in
 * the same phase, and `openGeneration` belongs in that hook once the create flow is whole — this
 * one is a merge candidate, not a second convention.
 */
export function useJdReviewActions() {
  const router = useRouter();

  return useMemo(
    () => ({
      goBack: () => router.back(),
      /**
       * Replace, not push. A generation is already running by the time this fires, so leaving
       * the form on the stack would let a back-swipe return to a confirmed JD and spend a
       * second generation on it.
       */
      openGeneration: (id: string) =>
        router.replace({ pathname: '/generations/[id]', params: { id } }),
      /**
       * Where a draft id that resolves to nothing sends the user: the intake that makes one.
       * Replace, because the form behind this never had a description to go back to.
       */
      openTailor: () => router.replace('/create/tailor'),
      /** Reached when the month's generations are spent (V2 §13.5). */
      openUpgrade: () => router.push({ pathname: '/upgrade', params: { reason: 'generations' } }),
    }),
    [router],
  );
}
