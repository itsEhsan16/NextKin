import { Stack } from 'expo-router/stack';

import { AppProviders, useAppReady } from '@/providers';
import { useTheme } from '@/theme';

/** Deep links into nested routes still get the tabs as their back target. */
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const { ready } = useAppReady();
  const { colors } = useTheme();

  // Splash stays up until fonts are ready; rendering nothing avoids a system-font flash.
  if (!ready) return null;

  return (
    <AppProviders>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.surfacePage },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="dev" />
        </Stack.Protected>
      </Stack>
    </AppProviders>
  );
}
