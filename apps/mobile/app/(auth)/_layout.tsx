import { Stack } from 'expo-router/stack';

import { useStackAnimation } from '@/navigation';
import { useTheme } from '@/theme';

/** The signed-out group (V2 §7.1). No headers: the welcome wash is the root of its own stack. */
export default function AuthLayout() {
  const { colors } = useTheme();
  const animation = useStackAnimation();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation,
        contentStyle: { backgroundColor: colors.surfacePage },
      }}
    />
  );
}
