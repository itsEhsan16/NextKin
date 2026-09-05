import { Stack } from 'expo-router/stack';

import { useTheme } from '@/theme';

/** The signed-out group (V2 §7.1). No headers: sign-in is the root of its own stack. */
export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surfacePage },
      }}
    />
  );
}
