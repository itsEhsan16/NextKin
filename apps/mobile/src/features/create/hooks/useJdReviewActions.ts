import { useRouter } from 'expo-router';
import { useMemo } from 'react';

/**
 * Routing for the JD review step (V2 §7.5 → §7.6). Screen-scoped rather than a feature-wide
 * `useCreateActions`, because the intake and tailor steps land in the same folder and each owns
 * its own destinations; fold them together once the whole create flow is in.
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
    }),
    [router],
  );
}
