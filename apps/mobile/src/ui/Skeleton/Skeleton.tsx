import { useEffect } from 'react';
import { type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme, type radii } from '@/theme';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: keyof typeof radii;
  style?: StyleProp<ViewStyle>;
};

/**
 * Loading placeholder block. A single opacity pulse on the UI thread — cheap enough to
 * render dozens at once, and it reads as "content is coming" without a gradient pass.
 */
export function Skeleton({ width = '100%', height = 16, radius = 'xs', style }: SkeletonProps) {
  const { colors, radii: r, motion } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    pulse.set(withRepeat(withTiming(1, { duration: motion.durations.pulse }), -1, true));
    return () => cancelAnimation(pulse);
  }, [motion.durations.pulse, pulse, reduced]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value * 0.5,
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: r[radius], backgroundColor: colors.skeletonBase },
        pulseStyle,
        style,
      ]}
    />
  );
}
