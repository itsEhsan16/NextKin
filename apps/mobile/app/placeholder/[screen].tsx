import { Stack, useLocalSearchParams } from 'expo-router';

import { PLACEHOLDERS, isPlaceholderKey } from '@/features/placeholders';
import { useTheme } from '@/theme';
import { PlaceholderScreen } from '@/ui/Placeholder';

/** Catch-all for navigation targets whose artboards haven't been implemented yet. */
export default function PlaceholderRoute() {
  const { screen } = useLocalSearchParams<{ screen: string }>();
  const { colors, fontFamily } = useTheme();
  const meta = screen && isPlaceholderKey(screen) ? PLACEHOLDERS[screen] : null;
  const title = meta?.title ?? 'Coming soon';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerBackButtonDisplayMode: 'minimal',
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontFamily: fontFamily.semiBold },
          headerStyle: { backgroundColor: colors.surfacePage },
          headerShadowVisible: false,
        }}
      />
      <PlaceholderScreen
        title={title}
        phase={meta?.phase}
        figmaScreens={meta?.figmaScreens ?? []}
        withTabBarInset={false}
      />
    </>
  );
}
