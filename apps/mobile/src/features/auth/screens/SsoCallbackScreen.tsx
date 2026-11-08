import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { Screen } from '@/ui/Screen';

/**
 * Where Google sign-in's browser hands back to the app (`nextkin://sso-callback`, Clerk's default
 * redirect; toreview §173). Clerk's hook has already read the result from the browser session, so
 * this page has nothing to show: it returns to the sign-in or sign-up form that started it, which
 * the signed-in flip then replaces with the tabs.
 */
export function SsoCallbackScreen() {
  const router = useRouter();
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/sign-in');
  }, [router]);
  return <Screen>{null}</Screen>;
}
