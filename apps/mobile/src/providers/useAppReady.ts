// Per-weight entries: the package root re-exports every weight/italic, which Metro would
// bundle as ~1MB of unused font assets.
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';

import { colorsByScheme, useResolvedScheme } from '@/theme';

// Keep the native splash visible until fonts are in. Wrapped because the call throws
// when the splash module is unavailable (web, some test environments).
try {
  void SplashScreen.preventAutoHideAsync();
} catch {
  // ignore
}

export type AppReadyState = {
  /** True once fonts are loaded (or failed, so the app still boots with system fonts). */
  ready: boolean;
  error: Error | null;
};

/** Boot gate for the root layout: fonts, splash screen and the native window background. */
export function useAppReady(): AppReadyState {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    // Brand wordmark only.
    Inter_700Bold,
  });
  const scheme = useResolvedScheme();

  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {
      // Splash may already be hidden; nothing to recover.
    });
  }, [ready]);

  useEffect(() => {
    // Paints the root window so over-scroll and navigation gaps match the page surface.
    SystemUI.setBackgroundColorAsync(colorsByScheme[scheme].surfacePage).catch(() => {
      // Unsupported on some platforms; purely cosmetic.
    });
  }, [scheme]);

  return { ready, error: fontError };
}
