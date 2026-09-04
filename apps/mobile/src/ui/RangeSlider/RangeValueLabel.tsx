import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps } from 'react-native-reanimated';

import { maxFontScale } from '@/lib';
import { useTheme, type ColorToken, type TypographyRole } from '@/theme';

import type { RangeBounds } from './RangeSlider';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export type RangeValueLabelProps = {
  /** The slider's live bounds. One worklet reads both, so the two halves can never tear. */
  bounds: RangeBounds;
  /** Committed value — seeds the text before the first worklet frame. */
  value: readonly [number, number];
  /**
   * MUST be a worklet (open the body with 'worklet'), and so must everything it calls.
   * `useAnimatedProps` below invokes it per frame on the UI runtime, where a plain JS closure
   * throws "Tried to synchronously call a Remote Function" — a crash no test can reach, because
   * Jest's Reanimated mock runs worklets as ordinary JS.
   */
  format: (value: number) => string;
  separator?: string;
  variant?: TypographyRole;
  color?: ColorToken;
  style?: StyleProp<TextStyle>;
};

/**
 * The "₹20L – ₹45L" readout beside a RangeSlider (Figma 1:798).
 *
 * Rendered through a non-editable TextInput so it repaints on the UI thread while a thumb is
 * dragged — a Text node would need a React render per frame. It is a11y-hidden because each thumb
 * already announces its own value.
 */
export function RangeValueLabel({
  bounds,
  value,
  format,
  separator = ' – ',
  variant = 'bodySemiBold',
  color = 'textPrimary',
  style,
}: RangeValueLabelProps) {
  const { colors, typography } = useTheme();
  const { low, high } = bounds;

  const animatedProps = useAnimatedProps(() => {
    const text = `${format(low.value)}${separator}${format(high.value)}`;
    return { text, defaultValue: text };
  });

  // Also the value tests can read: under the Reanimated jest mock, animatedProps never reach the
  // native text, so `defaultValue` is the only rendered source of truth.
  const seed = `${format(value[0])}${separator}${format(value[1])}`;

  return (
    <AnimatedTextInput
      accessible={false}
      importantForAccessibility="no"
      editable={false}
      // Bypasses the Text primitive, so the Dynamic Type cap has to be applied by hand.
      maxFontSizeMultiplier={maxFontScale.chrome}
      underlineColorAndroid="transparent"
      animatedProps={animatedProps}
      defaultValue={seed}
      style={[styles.input, typography[variant], { color: colors[color] }, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: { padding: 0, margin: 0, textAlign: 'right', includeFontPadding: false },
});
