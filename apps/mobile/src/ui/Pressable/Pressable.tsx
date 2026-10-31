import { useCallback, useEffect, type ComponentProps } from 'react';
import {
  Pressable as RNPressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { haptics, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';

const AnimatedRNPressable = Animated.createAnimatedComponent(RNPressable);

export type PressFeedback = 'scale' | 'subtle' | 'fab' | 'none';
export type PressHaptic = 'light' | 'medium' | 'selection' | 'none';

export type PressableProps = Omit<RNPressableProps, 'style'> & {
  /** Visual press feedback. `scale` = 0.97 (cards, tiles), `subtle` = 0.985 (rows). */
  feedback?: PressFeedback;
  /** Haptic fired on press (before `onPress`). Defaults to none. */
  haptic?: PressHaptic;
  /**
   * Dim to `opacity.disabled` while disabled (default). A control that is disabled only because
   * it is busy — a Button showing its spinner — keeps full strength instead.
   */
  dimDisabled?: boolean;
  /**
   * Also ease to `opacity.pressed` while held — for a solid-filled control (a Button), where a
   * scale alone barely reads on a block of colour.
   */
  pressDim?: boolean;
  /**
   * Mirrors the press (0 → 1) into a shared value the caller owns, so something drawn outside
   * this surface can move with it — the FAB's glow, which is a sibling.
   */
  pressProgress?: SharedValue<number>;
  /** A layout transition, for a surface whose size changes with its state (a chip gaining a ✓). */
  layout?: ComponentProps<typeof Animated.View>['layout'];
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's only tappable surface. Runs the press scale on the UI thread and fires the
 * semantic haptic so every interactive element feels identical.
 *
 * Opacity is animated too: whatever opacity the surface should show — the caller's own, or the
 * disabled dim, which wins — is eased to rather than set, so enabling or disabling a control
 * fades instead of snapping.
 */
export function Pressable({
  feedback = 'scale',
  haptic = 'none',
  dimDisabled = true,
  pressDim = false,
  pressProgress,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  style,
  children,
  ...rest
}: PressableProps) {
  const { motion, opacity } = useTheme();
  const reduced = useReducedMotion();
  const ownPressed = useSharedValue(0);
  const pressed = pressProgress ?? ownPressed;

  const target =
    feedback === 'none' || reduced
      ? 1
      : feedback === 'subtle'
        ? motion.scales.pressedSubtle
        : feedback === 'fab'
          ? motion.scales.fabPressed
          : motion.scales.pressed;

  // The opacity this surface should rest at: the caller's own (static) value, unless the disabled
  // dim applies, which wins over it — as the plain style override used to.
  const callerOpacity = StyleSheet.flatten(style)?.opacity;
  const restOpacity =
    disabled && dimDisabled
      ? opacity.disabled
      : typeof callerOpacity === 'number'
        ? callerOpacity
        : 1;
  const shownOpacity = useSharedValue(restOpacity);
  useEffect(() => {
    shownOpacity.set(reduced ? restOpacity : withTiming(restOpacity, motion.timings.fast));
  }, [motion.timings.fast, reduced, restOpacity, shownOpacity]);

  const heldOpacity = pressDim && !reduced ? opacity.pressed : 1;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shownOpacity.value * (1 - pressed.value * (1 - heldOpacity)),
    transform: [{ scale: 1 - pressed.value * (1 - target) }],
  }));

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      pressed.set(withTiming(1, motion.timings.press));
      onPressIn?.(event);
    },
    [motion.timings.press, onPressIn, pressed],
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      pressed.set(withTiming(0, motion.timings.press));
      onPressOut?.(event);
    },
    [motion.timings.press, onPressOut, pressed],
  );

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (haptic !== 'none') haptics[haptic]();
      onPress?.(event);
    },
    [haptic, onPress],
  );

  return (
    <AnimatedRNPressable
      accessibilityRole="button"
      {...rest}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedRNPressable>
  );
}
