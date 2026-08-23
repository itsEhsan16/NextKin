import { useCallback } from 'react';
import {
  Pressable as RNPressable,
  type GestureResponderEvent,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics, useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';

const AnimatedRNPressable = Animated.createAnimatedComponent(RNPressable);

export type PressFeedback = 'scale' | 'subtle' | 'none';
export type PressHaptic = 'light' | 'medium' | 'selection' | 'none';

export type PressableProps = Omit<RNPressableProps, 'style'> & {
  /** Visual press feedback. `scale` = 0.97 (cards, tiles), `subtle` = 0.985 (rows). */
  feedback?: PressFeedback;
  /** Haptic fired on press (before `onPress`). Defaults to none. */
  haptic?: PressHaptic;
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's only tappable surface. Runs the press scale on the UI thread and fires the
 * semantic haptic so every interactive element feels identical.
 */
export function Pressable({
  feedback = 'scale',
  haptic = 'none',
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  style,
  children,
  ...rest
}: PressableProps) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);

  const target =
    feedback === 'none' || reduced
      ? 1
      : feedback === 'subtle'
        ? motion.scales.pressedSubtle
        : motion.scales.pressed;

  const animatedStyle = useAnimatedStyle(() => ({
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
      style={[style, animatedStyle, disabled ? { opacity: 0.4 } : null]}
    >
      {children}
    </AnimatedRNPressable>
  );
}
