import { useEffect, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { a11yButton, useReducedMotion } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Spinner } from '@/ui/motion';

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline' | 'brand' | 'outline' | 'soft';
/** `xl` is the redesign's full pill (§172): 54 tall at 390, fully rounded, 16pt label. */
export type ButtonSize = 'md' | 'lg' | 'xl';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading line icon. */
  icon?: LineIconName;
  /** An illustrated mark before the label — the AI sparkle (RESUMES 09 577:9552). Wins over `icon`. */
  leading?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Standard button (Figma: 52/56 tall, r16). Primary is the ink-filled style.
 *
 * Loading keeps the label laid out — faded to nothing under a centred spinner — so a button that
 * hugs its label holds its width instead of shrinking to the spinner's, and the two cross-fade
 * rather than swap. A loading button is busy, not unavailable, so it keeps full strength. The
 * spinner is the app's own ring, the one every other wait draws.
 *
 * Held, it eases to `opacity.pressed` as well as scaling: on a solid block of colour the scale
 * alone barely reads.
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
  block = false,
  style,
}: ButtonProps) {
  const { colors, motion, radii, sizes, spacing, u } = useTheme();
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
    /** The AI action on a redesigned screen: brand fill, white label. */
    brand: { bg: colors.brand, fg: 'textOnBrand' },
    /** White pill with a hairline — social sign-in and quiet secondary actions. */
    outline: { bg: colors.surfaceCard, fg: 'textPrimary', border: colors.borderDefault },
    /** A light brand-tinted action inside a card (§173): Confirm, Add the real number. */
    soft: { bg: colors.brandSurface, fg: 'brand' },
  };
  const pill = size === 'xl';
  const height = pill ? u(54) : size === 'lg' ? sizes.buttonLg : sizes.buttonMd;
  const look = palette[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...a11yButton(label)}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      feedback="scale"
      pressDim
      onPress={onPress}
      disabled={isDisabled}
      dimDisabled={!loading}
      style={[
        {
          height,
          borderRadius: pill ? radii.full : radii.xl,
          paddingHorizontal: pill ? u(24) : spacing[5],
          backgroundColor: look.bg,
          borderWidth: look.border ? sizes.border : 0,
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
        {leading ?? (icon ? <Icon name={icon} size="sm" color={colors[look.fg]} /> : null)}
        <Text variant={pill ? 'buttonLabel' : 'bodySemiBold'} color={look.fg}>
          {label}
        </Text>
      </Animated.View>
      {loading ? (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(motion.durations.fast)}
          exiting={reduced ? undefined : FadeOut.duration(motion.durations.fast)}
          style={[StyleSheet.absoluteFill, styles.spinner]}
        >
          <Spinner size={sizes.iconSm} color={look.fg} />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  spinner: { alignItems: 'center', justifyContent: 'center' },
});
