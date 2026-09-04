import { Stack } from 'expo-router/stack';

import { useTheme } from '@/theme';

/** Dev gallery uses native headers so each page gets a back button for free. */
export default function DevLayout() {
  const { colors, fontFamily } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontFamily: fontFamily.semiBold, color: colors.textPrimary },
        headerStyle: { backgroundColor: colors.surfacePage },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.surfacePage },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Dev gallery' }} />
      <Stack.Screen name="tokens" options={{ title: 'Tokens' }} />
      <Stack.Screen name="typography" options={{ title: 'Typography' }} />
      <Stack.Screen name="motion" options={{ title: 'Motion' }} />
      <Stack.Screen name="mock" options={{ title: 'Mock data' }} />
      <Stack.Screen name="filters" options={{ title: 'Filters' }} />
    </Stack>
  );
}
