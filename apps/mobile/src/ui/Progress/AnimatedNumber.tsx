import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';

import { maxFontScale } from '@/lib';
import { useTheme, type ColorToken, type TypographyRole } from '@/theme';

import { useMeterValue, type MeterTiming } from './meterMemory';

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
  /** Start from what this key last showed, so a remount does not count up from 0 again. */
  memoryKey?: string;
  /** `follow` for a live figure that updates every beat; `meter` (default) otherwise. */
  timing?: MeterTiming;
  style?: StyleProp<TextStyle>;
};

const GLYPH_HEIGHT = 1.3;

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
  memoryKey,
  timing,
  style,
}: AnimatedNumberProps) {
  const { colors, typography } = useTheme();
  // Idle (and unread) when the caller drives the number with its own shared value or envelope.
  const owned = !progress && typeof value === 'number';
  const internal = useMeterValue(owned ? value : 0, { memoryKey, timing, animated: owned });

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

  // Android draws a TextInput's line at the font's own height whatever lineHeight says, and Plus
  // Jakarta Sans is tall (~1.26 em): a tighter role let the digits spill onto the ring's "ATS
  // SCORE" under them (owner's device, 2026-11-07). The box is never shorter than the glyphs.
  const role = typography[variant];
  const lineHeight = Math.max(role.lineHeight ?? 0, Math.ceil((role.fontSize ?? 0) * GLYPH_HEIGHT));

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
      style={[styles.input, role, { lineHeight, color: colors[color] }, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: { padding: 0, margin: 0, textAlign: 'center', includeFontPadding: false },
});
