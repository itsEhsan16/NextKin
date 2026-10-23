import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { auth, configureDataSource, onSignedOut, USES_BACKEND } from '@/data/dataSource';
import { configureMockMode } from '@/data/mock';
import { createQueryClient } from '@/data/queries/client';
import { ArtboardMode, FigmaOverlay } from '@/dev';
import { useSessionStore } from '@/features/auth';
import { storage } from '@/lib/storage';
import { AppToastHost } from '@/ui/Toast';
import { AiConsentGate } from '@/features/consent/AiConsentGate';
import { ServiceBanner } from '@/features/system/ServiceBanner';

// The mock-mode switch lives in @nextkin/shared, which must not import a native storage module,
// so the host wires persistence. At module scope on purpose: it has to run before the first
// render or a dev reload would come back in "normal" instead of the mode it was left in.
if (__DEV__) configureMockMode(storage);

// With EXPO_PUBLIC_DATA_SOURCE set, the configured repositories talk to the backend (P5-08), and
// the session flag follows the server session both ways:
// - the HTTP client's unrecoverable 401 (refresh failed) signs the device out;
// - every sign-out on the device (the profile sheet, sign-out-everywhere, a deleted account) ends
//   the server session and drops the tokens, so no screen has to remember to;
// - a device that remembers being signed in but holds no tokens starts signed out.
configureDataSource();
if (USES_BACKEND) {
  onSignedOut(() => useSessionStore.getState().signOut());
  useSessionStore.subscribe((state, previous) => {
    if (previous.status === 'signed_in' && state.status === 'signed_out') void auth.logout();
  });
  void auth.http.tokens?.get().then((tokens) => {
    if (!tokens && useSessionStore.getState().status === 'signed_in')
      useSessionStore.getState().signOut();
  });
}

export type AppProvidersProps = { children: ReactNode };

/**
 * Root provider stack. Order matters: gestures must wrap everything so sheets and
 * swipeable rows work inside navigators; safe-area must wrap the router.
 */
export function AppProviders({ children }: AppProvidersProps) {
  // Lazy initial state keeps a single client per app lifetime (survives re-renders/fast refresh).
  const [queryClient] = useState(createQueryClient);

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* The keyboard's frame-by-frame position, for every page's `KeyboardFrame` and every sheet
          that lifts over the keyboard. It detects the edge-to-edge window itself. */}
      <KeyboardProvider>
        {/* Seeded with the launch insets, so the first frame lays out at its final size instead of
          rendering nothing (or at zero insets) until the native measurement arrives. */}
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <QueryClientProvider client={queryClient}>
            <ArtboardMode>{children}</ArtboardMode>
            {/* After the navigator, so a confirmation paints above whichever screen it lands on. */}
            <AppToastHost />
            {/* P12-12: opens when an AI action is refused for want of consent. */}
            <AiConsentGate />
            {/* P13-02, R-09: what is degraded right now, when the app runs on the backend. */}
            <ServiceBanner />
            <FigmaOverlay />
            <StatusBar style="auto" />
          </QueryClientProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
