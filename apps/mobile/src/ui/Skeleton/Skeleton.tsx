import { useCallback, useEffect, useId, useRef } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  type DimensionValue,
  type StyleProp,
  type ViewInstance,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useReducedMotion } from '@/lib';
import { useTheme, type radii } from '@/theme';

import { acquireSkeletonClock, releaseSkeletonClock, skeletonClock } from './skeletonClock';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: keyof typeof radii;
  /**
   * `ai` for content the assistant is writing right now (a section being rewritten): the same
   * shimmer on the brand tint, so it never reads as the page itself still loading.
   */
  tone?: 'neutral' | 'ai';
  style?: StyleProp<ViewStyle>;
};

/**
 * Loading placeholder (§191, redrawn §196): a soft shape with one diagonal band of light sweeping
 * over it.
 *
 * - **One surface:** the band lives in screen space. Each block measures where it sits on the
 *   window and draws only its own slice of the one stripe, so every block on the page lights up
 *   in step as the same light crosses them — side by side, stacked or nested.
 * - **Soft, never outlined:** the base is ink at 5% (`skeletonBase`), so it reads on white and on
 *   the lavender wash alike. Never put a skeleton inside an elevated or bordered card: Android's
 *   elevation draws a hard dark edge around it (use `Card loading`).
 * - **No flash:** it waits `durations.skeletonDelay` before fading in. A load quicker than that
 *   goes straight from nothing to content, while the shape still holds the space.
 * - **No overlap:** it leaves at once. The content that replaces it does its own arrival, so grey
 *   never sits over the new content.
 * - **Reduced motion:** a still shape that appears at once, with no band.
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
  const ref = useRef<ViewInstance>(null);
  // Where this block sits on the window, so it can draw its own slice of the screen's band.
  const left = useSharedValue(0);
  const top = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    acquireSkeletonClock();
    return releaseSkeletonClock;
  }, [reduced]);

  const onLayout = useCallback(() => {
    ref.current?.measureInWindow((x, y) => {
      left.set(x);
      top.set(y);
    });
  }, [left, top]);

  const base = tone === 'ai' ? colors.brandSurface : colors.skeletonBase;

  return (
    <Animated.View
      ref={ref}
      onLayout={reduced ? undefined : onLayout}
      entering={
        reduced
          ? undefined
          : FadeIn.delay(motion.durations.skeletonDelay).duration(motion.durations.fast)
      }
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { width, height, borderRadius: r[radius], backgroundColor: base },
        style,
      ]}
    >
      {reduced ? null : <Band left={left} top={top} />}
    </Animated.View>
  );
}

/** This block's slice of the one diagonal stripe of light crossing the screen. */
function Band({ left, top }: { left: SharedValue<number>; top: SharedValue<number> }) {
  const { colors, motion } = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const sweep = skeletonClock();
  const id = `shimmer${useId().replace(/:/g, '')}`;

  const { bandShare, tiltDeg, peak } = motion.shimmer;
  const tilt = (tiltDeg * Math.PI) / 180;
  const bandW = screenW * bandShare;
  // Tall enough that, leaning, the stripe still spans the screen top to bottom.
  const bandH = screenH / Math.cos(tilt) + bandW * Math.tan(tilt);
  // How far past either edge the stripe's centre starts and ends, so it enters and leaves whole.
  const margin = bandW / (2 * Math.cos(tilt)) + (screenH / 2) * Math.tan(tilt);

  const style = useAnimatedStyle(() => {
    const centreX = -margin + sweep.value * (screenW + 2 * margin);
    return {
      transform: [
        { translateX: centreX - bandW / 2 - left.value },
        { translateY: screenH / 2 - bandH / 2 - top.value },
        { rotate: `${tiltDeg}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.band, { width: bandW, height: bandH }, style]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.skeletonHighlight} stopOpacity="0" />
            <Stop offset="0.3" stopColor={colors.skeletonHighlight} stopOpacity={peak * 0.35} />
            <Stop offset="0.5" stopColor={colors.skeletonHighlight} stopOpacity={peak} />
            <Stop offset="0.7" stopColor={colors.skeletonHighlight} stopOpacity={peak * 0.35} />
            <Stop offset="1" stopColor={colors.skeletonHighlight} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, left: 0 },
});
