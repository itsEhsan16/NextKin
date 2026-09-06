import { useRouter } from 'expo-router';
import { useMemo } from 'react';

/**
 * Every navigation the assistant makes (V2 §7.16). Deliberately short: the screen advises and
 * routes to the upsell, and nothing here writes user data.
 */
export function useAssistantActions() {
  const router = useRouter();

  return useMemo(
    () => ({
      goBack: () => router.back(),
      /** §13.5: the upsell names the limit it hit. */
      openUpgrade: () => router.push({ pathname: '/upgrade', params: { reason: 'assistant' } }),
    }),
    [router],
  );
}
