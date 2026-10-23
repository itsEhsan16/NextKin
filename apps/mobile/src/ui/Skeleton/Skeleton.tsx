import { useEffect } from 'react';
import { type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeOut, useAnimatedStyle } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { useTheme, type radii } from '@/theme';

import { acquireSkeletonClock, releaseSkeletonClock, skeletonClock } from './skeletonClock';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: keyof typeof radii;
  /**
   * `ai` for content the assistant is writing right now (a section being rewritten): the same
   * pulse on the brand tint, so it never reads as the page itself still loading.
   */
  tone?: 'neutral' | 'ai';
  style?: StyleProp<ViewStyle>;
};

/**
 * Loading placeholder block. An opacity pulse on the UI thread, shared by every block on screen
 * (`skeletonClock`), so a page of them breathes in step on a single animation and reads as
 * "content is coming" without a gradient pass.
 *
 * It fades out as it unmounts. Reanimated keeps a leaving view on screen out of layout, so when the
 * data lands the real content takes its place at once while the grey fades over it — a cross-fade
 * on every screen, instead of a hard cut.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 'xs',
  tone = 'neutral',
  style,
}: SkeletonProps) {
  const { colors, radii: r, motion } = useTheme();
  const reduced = useReducedMotion();
  const pulse = skeletonClock();

  useEffect(() => {
    if (reduced) return;
    acquireSkeletonClock();
    return releaseSkeletonClock;
  }, [reduced]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : 1 - pulse.value * 0.5,
  }));

  return (
    <Animated.View
      exiting={reduced ? undefined : FadeOut.duration(motion.durations.fast)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: r[radius],
          backgroundColor: tone === 'ai' ? colors.brandSurface : colors.skeletonBase,
        },
        pulseStyle,
        style,
      ]}
    />
  );
}
