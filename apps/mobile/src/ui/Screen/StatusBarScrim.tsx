import { StyleSheet } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

/** How far the page scrolls before the strip is fully in, at 390. */
const FADE_OVER = 28;

/**
 * The strip behind the status bar on a page that runs to the top of the glass (§199). At rest it
 * is clear, so the lavender wash flows up behind the clock and icons with no white band; as the
 * page scrolls it fades to the page colour, so text never slides under the status icons. On the
 * UI thread, from the page's own scroll offset.
 */
export function StatusBarScrim({ offset }: { offset: SharedValue<number> }) {
  const { colors, u } = useTheme();
  const insets = useSafeAreaInsets();
  const reach = u(FADE_OVER);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, reach], [0, 1], 'clamp'),
  }));
  if (insets.top <= 0) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.strip, { height: insets.top, backgroundColor: colors.surfacePage }, style]}
    />
  );
}

const styles = StyleSheet.create({
  strip: { position: 'absolute', top: 0, left: 0, right: 0 },
});
