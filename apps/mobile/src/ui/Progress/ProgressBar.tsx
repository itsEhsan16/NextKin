import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';

export type ProgressBarProps = {
  /** 0–1 */
  value: number;
  height?: number;
  trackColor?: ColorToken;
  fillColor?: ColorToken;
  /** Animate from 0 on mount (and on every change). Defaults to true. */
  animated?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** 8px pill progress bar. Fill width animates on the UI thread with the `meter` timing. */
export function ProgressBar({
  value,
  height,
  trackColor = 'progressTrack',
  fillColor = 'progressFill',
  animated = true,
  accessibilityLabel,
  style,
}: ProgressBarProps) {
  const { colors, radii, motion, s } = useTheme();
  // The artboard bar is 8 in 520 space — 6dp at 390. A raw 8 here rendered a third too thick,
  // and thicker still as the screen narrowed.
  const barHeight = height ?? s(8);
  const reduced = useReducedMotion();
  const target = clamp01(value);
  const progress = useSharedValue(animated ? 0 : target);

  useEffect(() => {
    progress.set(
      animated ? withTiming(target, withReducedMotion(reduced, motion.timings.meter)) : target,
    );
  }, [animated, motion.timings.meter, progress, reduced, target]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={[
        {
          height: barHeight,
          borderRadius: radii.full,
          backgroundColor: colors[trackColor],
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          { height: barHeight, borderRadius: radii.full, backgroundColor: colors[fillColor] },
          fillStyle,
        ]}
      />
    </View>
  );
}
