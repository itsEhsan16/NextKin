import { useEffect, useId, type ReactNode } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle } from 'react-native-reanimated';
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

/** The light band's width, as a share of the screen. Wide and soft, so it reads as light. */
const BAND = 0.55;

/**
 * Loading placeholder (redrawn §191): a flat block with one soft band of light sweeping across
 * it. Every block on screen sweeps on the same clock (`skeletonClock`), and the band travels the
 * screen's width, so blocks side by side and stacked light up in step, as one surface.
 *
 * - **No flash:** it waits `durations.skeletonDelay` before fading in. A load quicker than that
 *   goes straight from nothing to content, while the block still holds the space.
 * - **Cross-fade out:** Reanimated keeps a leaving view on screen out of layout, so the content
 *   takes its place at once while the grey fades over it.
 * - **Reduced motion:** a still block that appears at once, with no band.
 *
 * Use few, large blocks: one per section, sized like the section (`SkeletonBlock`), not one per
 * line of text.
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
  const sweep = skeletonClock();
  const { width: screen } = useWindowDimensions();
  const band = screen * BAND;
  const id = `shimmer${useId().replace(/:/g, '')}`;

  useEffect(() => {
    if (reduced) return;
    acquireSkeletonClock();
    return releaseSkeletonClock;
  }, [reduced]);

  const bandStyle = useAnimatedStyle(() => ({
    // From just off the left edge to just off the right one, on the shared clock.
    transform: [{ translateX: -band + sweep.value * (screen + band) }],
  }));

  const base = tone === 'ai' ? colors.brandSurface : colors.skeletonBase;

  return (
    <Animated.View
      entering={
        reduced
          ? undefined
          : FadeIn.delay(motion.durations.skeletonDelay).duration(motion.durations.fast)
      }
      exiting={reduced ? undefined : FadeOut.duration(motion.durations.fast)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { width, height, borderRadius: r[radius], backgroundColor: base },
        style,
      ]}
    >
      {reduced ? null : (
        <Animated.View pointerEvents="none" style={[styles.band, { width: band }, bandStyle]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.skeletonHighlight} stopOpacity="0" />
                <Stop offset="0.5" stopColor={colors.skeletonHighlight} stopOpacity="0.9" />
                <Stop offset="1" stopColor={colors.skeletonHighlight} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/**
 * One section's placeholder (§191): a single block in the section's own shape and height, with
 * the card radius. Prefer one of these per section over a stack of line skeletons.
 */
export function SkeletonBlock({
  height,
  width = '100%',
  tone,
  style,
}: {
  height: number;
  width?: DimensionValue;
  tone?: SkeletonProps['tone'];
  style?: StyleProp<ViewStyle>;
}) {
  const { u } = useTheme();
  return (
    <Skeleton width={width} height={height} tone={tone} style={[{ borderRadius: u(24) }, style]} />
  );
}

/** A row of blocks that sit side by side (a carousel's cards, a stat strip). */
export function SkeletonRow({ children, gap }: { children: ReactNode; gap: number }) {
  return <View style={[styles.row, { gap }]}>{children}</View>;
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  row: { flexDirection: 'row' },
});
