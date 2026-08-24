import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { hitSlopFor, useReducedMotion, withReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';

import { clampHigh, clampLow, fractionOf, pxToValue, quantise } from './rangeMath';

/** UI-thread mirror of both bounds, so a readout elsewhere in the tree cannot drift from the thumbs. */
export type RangeBounds = { low: SharedValue<number>; high: SharedValue<number> };

export type RangeSliderProps = {
  min: number;
  max: number;
  step: number;
  /** Committed value, ordered: `min <= value[0] <= value[1] <= max`. */
  value: readonly [number, number];
  /** Fires once per interaction — drag release, track tap, a11y action. Never per frame. */
  onChange: (value: [number, number]) => void;
  /**
   * Optional external mirror of the live bounds, owned by the caller so a label rendered outside
   * this component animates from the same values — the same contract as `Sheet`'s `progress`.
   */
  bounds?: RangeBounds;
  /** Minimum gap between the thumbs, in value units. Defaults to `step`. */
  minDistance?: number;
  /** Step used by screen-reader increment/decrement. Defaults to a twentieth of the range. */
  a11yStep?: number;
  /** Accessible names for the two thumbs. */
  thumbLabels: readonly [string, string];
  /**
   * Renders a bound for `accessibilityValue.text` — "2000000" alone is unreadable aloud. Called
   * on the JS thread only, so unlike `RangeValueLabel`'s `format` it need not be a worklet —
   * but callers usually pass the same function to both, and that one must be.
   */
  format: (value: number) => string;
  style?: StyleProp<ViewStyle>;
};

const THUMB = 26;
const TRACK_HEIGHT = 6;
const ADJUST_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

/**
 * Dual-thumb range slider (Figma JOBS 04, 1:799–1:802). Built on Gesture Handler + Reanimated
 * because no slider package can ship inside Expo Go, and a dual-thumb control has no RN core
 * equivalent anyway.
 *
 * Both thumbs live entirely on the UI thread: dragging re-renders React zero times and calls JS
 * exactly once, on release. That is what keeps the sheet's live result count off the frame path.
 */
export function RangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  bounds,
  minDistance = step,
  a11yStep,
  thumbLabels,
  format,
  style,
}: RangeSliderProps) {
  const { colors, radii, shadows, motion } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  const [trackWidth, setTrackWidth] = useState(0);
  const travel = Math.max(0, trackWidth - THUMB);

  const internalLow = useSharedValue(value[0]);
  const internalHigh = useSharedValue(value[1]);
  const low = bounds?.low ?? internalLow;
  const high = bounds?.high ?? internalHigh;
  // Set while a thumb is under a finger, so the prop-sync effect below cannot fight the drag.
  const dragging = useSharedValue(false);

  const settle = useMemo(
    () => withReducedMotion(reduced, motion.springs.snappy),
    [motion.springs.snappy, reduced],
  );

  const commit = useCallback(
    (nextLow: number, nextHigh: number) => onChange([nextLow, nextHigh]),
    [onChange],
  );

  // Adopt externally-changed values (Reset, or a draft re-seeded on open) without animating over
  // the user's own drag. Keyed on the two numbers rather than the tuple: callers rebuild the array
  // each render, and identity deps would restart the spring on every unrelated parent update.
  const [committedLow, committedHigh] = value;
  useEffect(() => {
    if (dragging.value) return;
    low.set(withSpring(committedLow, settle));
    high.set(withSpring(committedHigh, settle));
  }, [committedHigh, committedLow, dragging, high, low, settle]);

  const measure = useCallback((event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    setTrackWidth((current) => (current === width ? current : width));
  }, []);

  // Memoised on everything the worklets capture so GestureDetector does not re-attach every render.
  const lowPan = useMemo(
    () =>
      Gesture.Pan()
        // Claim horizontal movement before any vertical ancestor (the sheet, the ScrollView) can.
        .activeOffsetX([-4, 4])
        .onBegin(() => {
          dragging.set(true);
        })
        .onUpdate((event) => {
          const startPx = fractionOf(low.value, min, max) * travel;
          const next = pxToValue(startPx + event.translationX, min, max, travel, step);
          low.set(clampLow(next, min, high.value, minDistance));
        })
        .onFinalize(() => {
          dragging.set(false);
          runOnJS(commit)(low.value, high.value);
        }),
    [commit, dragging, high, low, max, min, minDistance, step, travel],
  );

  const highPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-4, 4])
        .onBegin(() => {
          dragging.set(true);
        })
        .onUpdate((event) => {
          const startPx = fractionOf(high.value, min, max) * travel;
          const next = pxToValue(startPx + event.translationX, min, max, travel, step);
          high.set(clampHigh(next, low.value, max, minDistance));
        })
        .onFinalize(() => {
          dragging.set(false);
          runOnJS(commit)(low.value, high.value);
        }),
    [commit, dragging, high, low, max, min, minDistance, step, travel],
  );

  /** Screen readers deliver swipe-up/down and volume keys here, so the slider works without dragging. */
  const nudge = useCallback(
    (thumb: 'low' | 'high') => (event: AccessibilityActionEvent) => {
      const delta =
        (a11yStep ?? Math.max(step, (max - min) / 20)) *
        (event.nativeEvent.actionName === 'increment' ? 1 : -1);
      if (thumb === 'low') {
        const next = clampLow(
          quantise(value[0] + delta, min, max, step),
          min,
          value[1],
          minDistance,
        );
        commit(next, value[1]);
        return;
      }
      const next = clampHigh(
        quantise(value[1] + delta, min, max, step),
        value[0],
        max,
        minDistance,
      );
      commit(value[0], next);
    },
    [a11yStep, commit, max, min, minDistance, step, value],
  );

  const fillStyle = useAnimatedStyle(() => {
    const from = fractionOf(low.value, min, max) * travel;
    const to = fractionOf(high.value, min, max) * travel;
    return { left: from + THUMB / 2, width: Math.max(0, to - from) };
  });
  const lowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fractionOf(low.value, min, max) * travel }],
  }));
  const highStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fractionOf(high.value, min, max) * travel }],
  }));

  const thumbStyle = {
    width: THUMB,
    height: THUMB,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceCard,
    borderColor: colors.surfaceInverse,
  };

  return (
    <View onLayout={measure} style={[styles.track, style]}>
      <View
        style={[
          styles.rail,
          { height: TRACK_HEIGHT, borderRadius: radii.full, backgroundColor: colors.progressTrack },
        ]}
      />
      {/* Spans thumb centre to thumb centre, so the unselected part of the range reads as unfilled. */}
      <Animated.View
        style={[
          styles.fill,
          {
            height: TRACK_HEIGHT,
            borderRadius: radii.full,
            backgroundColor: colors.surfaceInverse,
          },
          fillStyle,
        ]}
      />

      <GestureDetector gesture={lowPan}>
        <Animated.View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={thumbLabels[0]}
          accessibilityValue={{ min, max, now: value[0], text: format(value[0]) }}
          accessibilityActions={ADJUST_ACTIONS}
          onAccessibilityAction={nudge('low')}
          hitSlop={hitSlopFor(THUMB)}
          style={[styles.thumb, thumbStyle, shadows.sliderThumb, lowStyle]}
        />
      </GestureDetector>

      <GestureDetector gesture={highPan}>
        <Animated.View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={thumbLabels[1]}
          accessibilityValue={{ min, max, now: value[1], text: format(value[1]) }}
          accessibilityActions={ADJUST_ACTIONS}
          onAccessibilityAction={nudge('high')}
          hitSlop={hitSlopFor(THUMB)}
          style={[styles.thumb, thumbStyle, shadows.sliderThumb, highStyle]}
        />
      </GestureDetector>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  track: { height: THUMB, justifyContent: 'center' },
  rail: { position: 'absolute', left: 0, right: 0 },
  // `left`/`width` are driven by the worklet, so this one must not also pin `right`.
  fill: { position: 'absolute' },
  thumb: { position: 'absolute', left: 0, borderWidth: s(2) },
}));
