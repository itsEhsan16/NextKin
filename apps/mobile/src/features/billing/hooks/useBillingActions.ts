import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { openExternalUrl, WEB_URL } from '@/lib';

import { BILLING_PATH } from '../upgradeCopy';

/**
 * The two places the plan screen can send you (V2 §13.4 / §15): back where you came from, and out
 * to the web, which is the only surface that takes payment. Routing lives here rather than in the
 * screen, exactly as `useCreateActions` and `useProfileActions` do it.
 */
export function useBillingActions() {
  const router = useRouter();

  return useMemo(
    () => ({
      goBack: () => router.back(),
      /**
       * Resolves 'done' or 'unavailable' — the caller shows the fallback line rather than leaving
       * a press that did nothing look like a broken button.
       */
      manageOnWeb: () => openExternalUrl(`${WEB_URL}${BILLING_PATH}`),
      /** The backend's hosted checkout (P12-06), in the browser: nothing is sold in the app (D-18). */
      openCheckout: (url: string) => openExternalUrl(url),
    }),
    [router],
  );
}
