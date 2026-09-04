import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createQueryClient } from '@/data/queries/client';
import { ArtboardMode, FigmaOverlay } from '@/dev';

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
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ArtboardMode>{children}</ArtboardMode>
          <FigmaOverlay />
          <StatusBar style="auto" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
