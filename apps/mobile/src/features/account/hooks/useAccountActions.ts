import { useRouter } from 'expo-router';
import { useMemo } from 'react';

/** Every navigation the account screens make (V2 §7.1 sessions, §8.5 the data export). */
export function useAccountActions() {
  const router = useRouter();

  return useMemo(
    () => ({
      goBack: () => router.back(),
      /** Where "Sign out everywhere" leaves you: this device is one of the sessions it revoked. */
      openSignIn: () => router.replace('/sign-in'),
      openPrivacy: () => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } }),
      openSupport: () => router.push('/support/contact'),
    }),
    [router],
  );
}
