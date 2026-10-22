import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { a11yButton, useReducedMotion } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Pressable, type PressHaptic } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading FA5 glyph. */
  icon?: string;
  /** An illustrated mark before the label — the AI sparkle (RESUMES 09 577:9552). Wins over `icon`. */
  leading?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  haptic?: PressHaptic;
  /** Stretch to the container width. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Standard button (Figma: 52/56 tall, r16). Primary is the ink-filled style.
 *
 * Loading keeps the label laid out — faded to nothing under a centred spinner — so a button that
 * hugs its label holds its width instead of shrinking to the spinner's, and the two cross-fade
 * rather than swap. A loading button is busy, not unavailable, so it keeps full strength.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  leading,
  loading = false,
  disabled = false,
  haptic = 'light',
  block = false,
  style,
}: ButtonProps) {
  const { colors, motion, radii, sizes, spacing, s } = useTheme();
  const reduced = useReducedMotion();
  const busy = useSharedValue(loading ? 1 : 0);
  useEffect(() => {
    const to = loading ? 1 : 0;
    busy.set(reduced ? to : withTiming(to, motion.timings.fast));
  }, [busy, loading, motion.timings.fast, reduced]);
  const labelStyle = useAnimatedStyle(() => ({ opacity: 1 - busy.value }));

  const palette: Record<ButtonVariant, { bg: string; fg: ColorToken; border?: string }> = {
    primary: { bg: colors.surfaceInverse, fg: 'textOnDark' },
    secondary: { bg: colors.surfaceSubtle, fg: 'textPrimary' },
    ghost: { bg: 'transparent', fg: 'textPrimary', border: colors.borderDefault },
    danger: { bg: colors.dangerSurface, fg: 'danger' },
    /** The profile editors' Delete: white, a soft red border, red label (Figma 573:285). */
    dangerOutline: { bg: colors.surfaceCard, fg: 'danger', border: colors.dangerBorder },
  };
  const look = palette[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...a11yButton(label)}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      feedback="scale"
      haptic={haptic}
      onPress={onPress}
      disabled={isDisabled}
      dimDisabled={!loading}
      style={[
        {
          height: size === 'lg' ? sizes.buttonLg : sizes.buttonMd,
          borderRadius: radii.xl,
          paddingHorizontal: spacing[5],
          backgroundColor: look.bg,
          borderWidth: look.border ? 1 : 0,
          borderColor: look.border ?? 'transparent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[2],
          alignSelf: block ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      <Animated.View
        style={[styles.label, { gap: spacing[2] }, labelStyle]}
        accessibilityElementsHidden={loading}
        importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}
      >
        {leading ??
          (icon ? <FontAwesome5 name={icon} size={s(14)} color={colors[look.fg]} solid /> : null)}
        <Text variant="bodySemiBold" color={look.fg}>
          {label}
        </Text>
      </Animated.View>
      {loading ? (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
          exiting={reduced ? undefined : FadeOut.duration(motion.durations.fast)}
          style={[StyleSheet.absoluteFill, styles.spinner]}
        >
          <ActivityIndicator color={colors[look.fg]} />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  spinner: { alignItems: 'center', justifyContent: 'center' },
});
