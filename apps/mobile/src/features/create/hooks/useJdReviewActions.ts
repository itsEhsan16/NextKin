import { useRouter } from 'expo-router';
import { useMemo } from 'react';

/** Routing for "Job details" (V2 §7.5): back to where it was opened, or a new intake. */
export function useJdReviewActions() {
  const router = useRouter();

  return useMemo(
    () => ({
      goBack: () => router.back(),
      /**
       * Where a draft id that resolves to nothing sends the user: the intake that makes one.
       * Replace, because the form behind this never had a description to go back to.
       */
      openTailor: () => router.replace('/create/build'),
    }),
    [router],
  );
}
