import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useTheme, type ColorToken } from '@/theme';
import { useLoop } from '@/ui/motion/useLoop';

import { useMeterValue, type MeterTiming } from './meterMemory';

export type ProgressBarProps = {
  /** 0–1 */
  value: number;
  height?: number;
  trackColor?: ColorToken;
  fillColor?: ColorToken;
  /** Animate from 0 on mount (and on every change). Defaults to true. */
  animated?: boolean;
  /** Start from what this key last showed, so a remount does not sweep from 0 again. */
  memoryKey?: string;
  /** `follow` for live progress that updates every beat; `meter` (default) otherwise. */
  timing?: MeterTiming;
  /**
   * Work is happening right now: a soft light travels along the filled part, so the bar reads as
   * alive between updates (a late tick never looks like a stall). Off under Reduce Motion.
   */
  live?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** The travelling light's width, as a share of the track. */
const SHEEN_SHARE = 0.35;

/** 8px pill progress bar. Fill width animates on the UI thread with the `meter` timing. */
export function ProgressBar({
  value,
  height,
  trackColor = 'progressTrack',
  fillColor = 'progressFill',
  animated = true,
  memoryKey,
  timing,
  live = false,
  accessibilityLabel,
  style,
}: ProgressBarProps) {
  const { colors, motion, opacity, radii, s } = useTheme();
  // The artboard bar is 8 in 520 space — 6dp at 390. A raw 8 here rendered a third too thick,
  // and thicker still as the screen narrowed.
  const barHeight = height ?? s(8);
  const target = clamp01(value);
  const progress = useMeterValue(target, { memoryKey, timing, animated });
  // Only a live bar measures itself: the light has to know how far the fill reaches.
  const [trackWidth, setTrackWidth] = useState(0);
  const sweep = useLoop(live && trackWidth > 0, motion.loops.sheen);
  const band = trackWidth * SHEEN_SHARE;
  const glow = opacity.sheen;

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // From just off the fill's left end to just past its right end, wherever that is right now.
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: sweep.value > 0 ? glow : 0,
    transform: [{ translateX: -band + sweep.value * (trackWidth * progress.value + band) }],
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      onLayout={live ? (event) => setTrackWidth(event.nativeEvent.layout.width) : undefined}
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
          {
            height: barHeight,
            borderRadius: radii.full,
            backgroundColor: colors[fillColor],
            overflow: 'hidden',
          },
          fillStyle,
        ]}
      >
        {live ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: band,
                borderRadius: radii.full,
                backgroundColor: colors.textOnBrand,
              },
              sheenStyle,
            ]}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}
