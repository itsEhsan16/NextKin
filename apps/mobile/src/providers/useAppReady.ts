// Per-weight entries: the package root re-exports every weight/italic, which Metro would
// bundle as ~1MB of unused font assets.
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { isRunningInExpoGo } from 'expo';
import { useEffect } from 'react';

import { colorsByScheme, durations, useResolvedScheme } from '@/theme';

// Keep the native splash visible until fonts are in. Wrapped because the call throws
// when the splash module is unavailable (web, some test environments).
try {
  void SplashScreen.preventAutoHideAsync();
  // Fade the splash out rather than cutting to the first frame (iOS draws the fade; Android's
  // system splash keeps its own exit). Expo Go owns its splash and only warns, so builds only.
  if (!isRunningInExpoGo()) SplashScreen.setOptions({ fade: true, duration: durations.base });
} catch {
  // ignore
}

/**
 * The icon font every glyph in the app draws from (`solid` and the outline `regular` cut; no
 * brand icons are used). Loaded behind the splash with the text faces: left to load on first
 * use, every icon rendered blank for a beat and then popped in.
 */
const ICON_FONTS: Record<string, number> = Object.fromEntries(
  Object.entries(FontAwesome5.font as Record<string, number>).filter(([family]) =>
    /^FontAwesome5Free-(Solid|Regular)$/.test(family),
  ),
);

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
    ...ICON_FONTS,
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
