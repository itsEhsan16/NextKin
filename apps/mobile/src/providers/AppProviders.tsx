import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { watchConnection } from '@/data/connection';
import { clerkSignedOut } from '@/data/clerkSession';
import {
  auth,
  configureDataSource,
  onSignedOut,
  USES_BACKEND,
  USES_CLERK,
} from '@/data/dataSource';

import { ClerkGate } from './ClerkGate';
import { forgetPushDevice } from '@/data/pushDevice';
import { configureMockMode } from '@/data/mock';
import { flushEvents } from '@/data/queries';
import { clearOldResumeCopy, createAppQueryClient } from '@/data/savedResumes';
import { ArtboardMode, FigmaOverlay } from '@/dev';
import { useSessionStore } from '@/features/auth';
import { startCrashReports } from '@/lib/crashReports';
import { storage } from '@/lib/storage';
import { AppToastHost } from '@/ui/Toast';
import { AiConsentGate } from '@/features/consent/AiConsentGate';
import { ServiceBanner } from '@/features/system/ServiceBanner';

import { AppErrorBoundary } from './AppErrorBoundary';
import { useWipeOnSignOut } from './useWipeOnSignOut';

// First, so a failure in anything below is reported.
startCrashReports();

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
    // The phone leaves first, while the session it has to prove itself with still works.
    if (previous.status === 'signed_in' && state.status === 'signed_out') {
      void forgetPushDevice().finally(() => auth.logout());
    }
  });
  // On Clerk only a loaded Clerk with no session means signed out: offline at launch is not.
  const signedOutHere = USES_CLERK
    ? clerkSignedOut()
    : (auth.http.tokens?.get().then((tokens) => !tokens) ?? Promise.resolve(false));
  void signedOutHere.then((gone) => {
    if (gone && useSessionStore.getState().status === 'signed_in')
      useSessionStore.getState().signOut();
  });
}

watchConnection();

// Resumes aren't kept on the phone (toreview §148.1): a copy an earlier build saved goes.
clearOldResumeCopy();

// Usage events leave with the app: the next open may be days away.
if (USES_BACKEND) {
  AppState.addEventListener('change', (state) => {
    if (state === 'background') flushEvents();
  });
}

export type AppProvidersProps = { children: ReactNode };

/**
 * Root provider stack. Order matters: gestures must wrap everything so sheets and
 * swipeable rows work inside navigators; safe-area must wrap the router.
 */
export function AppProviders({ children }: AppProvidersProps) {
  // Lazy initial state keeps a single client per app lifetime (survives re-renders/fast refresh).
  const [queryClient] = useState(createAppQueryClient);
  useWipeOnSignOut(queryClient);

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Clerk's context for the sign-in hooks, when the app signs in through Clerk (§173). */}
      <ClerkGate>
        {/* The keyboard's frame-by-frame position, for every page's `KeyboardFrame` and every sheet
          that lifts over the keyboard. It detects the edge-to-edge window itself. */}
        <KeyboardProvider>
          {/* Seeded with the launch insets, so the first frame lays out at its final size instead of
          rendering nothing (or at zero insets) until the native measurement arrives. */}
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <QueryClientProvider client={queryClient}>
              {/* Inside the providers, so a crashed screen's fallback keeps every context. */}
              <AppErrorBoundary>
                <ArtboardMode>{children}</ArtboardMode>
              </AppErrorBoundary>
              {/* After the navigator, so a confirmation paints above whichever screen it lands on. */}
              <AppToastHost />
              {/* P12-12: opens when an AI action is refused for want of consent. */}
              <AiConsentGate />
              {/* P13-02, R-09: what is degraded right now, when the app runs on the backend. */}
              <ServiceBanner />
              <FigmaOverlay />
              {/* Dark icons always: "auto" follows the OS and would go white over the light app. */}
              <StatusBar style="dark" />
            </QueryClientProvider>
          </SafeAreaProvider>
        </KeyboardProvider>
      </ClerkGate>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
