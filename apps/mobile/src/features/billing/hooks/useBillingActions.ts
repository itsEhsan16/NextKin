import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { openExternalUrl, WEB_URL } from '@/lib';

import { sellsInApp } from '../storePolicy';
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
      manageOnWeb: () =>
        // Android never leaves for a billing page (Play Payments policy, storePolicy.ts). The
        // screen draws no button for it there; this is the backstop if one ever slips in.
        sellsInApp()
          ? openExternalUrl(`${WEB_URL}${BILLING_PATH}`)
          : Promise.resolve('unavailable' as const),
      /** The backend's hosted checkout (P12-06), in the browser: nothing is sold in the app (D-18). */
      openCheckout: (url: string) =>
        sellsInApp() ? openExternalUrl(url) : Promise.resolve('unavailable' as const),
    }),
    [router],
  );
}
