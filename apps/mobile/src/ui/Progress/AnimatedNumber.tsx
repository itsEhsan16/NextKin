import { useEffect } from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { maxFontScale, useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme, type ColorToken, type TypographyRole } from '@/theme';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export type AnimatedNumberProps = {
  /**
   * Target value. A plain number counts up from 0 (or from the previous value) on change.
   * A SharedValue instead hands the animation to the caller, so the digits stay in lockstep
   * with whatever else that value drives (ScoreRing's arc) — still on the UI thread.
   */
  value: number | SharedValue<number>;
  /**
   * Drive the number from an external 0–1 envelope multiplied by `value`. Ignored when
   * `value` is itself a SharedValue.
   */
  progress?: SharedValue<number>;
  variant?: TypographyRole;
  color?: ColorToken;
  /**
   * MUST be a worklet (open the body with 'worklet'): it runs per frame on the UI runtime,
   * and a plain JS closure there throws "Tried to synchronously call a Remote Function".
   */
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
};

const defaultFormat = (n: number) => {
  'worklet';
  return String(Math.round(n));
};

/**
 * Count-up number rendered through a non-editable TextInput so the text updates on the UI
 * thread (no React re-render per frame). Used by score rings and stat tiles.
 */
export function AnimatedNumber({
  value,
  progress,
  variant = 'statRegular',
  color = 'textBlack',
  format = defaultFormat,
  style,
}: AnimatedNumberProps) {
  const { colors, typography, motion } = useTheme();
  const reduced = useReducedMotion();
  const internal = useSharedValue(0);

  useEffect(() => {
    if (progress || typeof value !== 'number') return;
    internal.set(withTiming(value, withReducedMotion(reduced, motion.timings.meter)));
  }, [internal, motion.timings.meter, progress, reduced, value]);

  const animatedProps = useAnimatedProps(() => {
    let current: number;
    if (typeof value !== 'number') {
      current = value.value;
    } else if (progress) {
      current = progress.value * value;
    } else {
      current = internal.value;
    }
    return { text: format(current), defaultValue: format(current) };
  });

  return (
    <AnimatedTextInput
      accessible={false}
      importantForAccessibility="no"
      editable={false}
      // The raw TextInput bypasses the Text primitive, so it needs the Dynamic Type cap
      // applied here or the digits outgrow the fixed meter boxes at accessibility sizes.
      maxFontSizeMultiplier={maxFontScale.chrome}
      underlineColorAndroid="transparent"
      animatedProps={animatedProps}
      defaultValue={format(0)}
      style={[styles.input, typography[variant], { color: colors[color] }, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: { padding: 0, margin: 0, textAlign: 'center', includeFontPadding: false },
});
