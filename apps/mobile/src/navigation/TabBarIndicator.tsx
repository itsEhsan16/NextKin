import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';

export type TabBarIndicatorProps = {
  /** The active tab's centre, in pill coordinates. */
  centre: number;
  width: number;
  height: number;
};

/** How much wider the light gets at the middle of a move: a stretch, never a wobble. */
const STRETCH = 0.45;
/** How much it thins as it stretches. */
const SQUASH = 0.12;

/**
 * The selected tab's soft lavender light (owner, 2026-11-08, §192). It glides from tab to tab on
 * the UI thread: a critically damped spring for the position, so it arrives without bouncing,
 * and a stretch that peaks mid-way and settles as it lands, so the move reads as one liquid
 * gesture rather than a jump. It sits under the icons and labels and never takes a touch.
 * Reduced motion: it moves at once.
 */
export function TabBarIndicator({ centre, width, height }: TabBarIndicatorProps) {
  const { colors, motion } = useTheme();
  const reduced = useReducedMotion();
  const x = useSharedValue(centre);
  // 0 → 1 over each move, so the stretch can rise and fall with it.
  const travel = useSharedValue(1);
  const first = useSharedValue(true);

  useEffect(() => {
    if (reduced || first.get()) {
      first.set(false);
      x.set(centre);
      return;
    }
    x.set(withSpring(centre, { duration: motion.durations.sheetIn + 80, dampingRatio: 1 }));
    travel.set(0);
    travel.set(
      withTiming(1, { duration: motion.durations.sheetIn, easing: motion.easings.standard }),
    );
  }, [centre, first, motion, reduced, travel, x]);

  const style = useAnimatedStyle(() => {
    // A sine of the move's progress: 0 at rest, the full stretch half-way through. It thins a
    // little as it stretches, like a drop pulled along.
    const pull = Math.sin(Math.PI * travel.value);
    return {
      transform: [
        { translateX: x.value - width / 2 },
        { scaleX: 1 + STRETCH * pull },
        { scaleY: 1 - SQUASH * pull },
      ],
    };
  });

  return (
    <Animated.View
      testID="tab-light"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.light,
        {
          width,
          height,
          borderRadius: height / 2,
          backgroundColor: colors.brandSurface,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  // No `top`: the pill centres its children, so the light sits on the bar's middle line.
  light: { position: 'absolute', left: 0 },
});
