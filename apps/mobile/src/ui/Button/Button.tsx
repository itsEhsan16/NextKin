import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Pressable, type PressHaptic } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading FA5 glyph. */
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  haptic?: PressHaptic;
  /** Stretch to the container width. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Standard button (Figma: 52/56 tall, r16). Primary is the ink-filled style. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  haptic = 'light',
  block = false,
  style,
}: ButtonProps) {
  const { colors, radii, sizes, spacing } = useTheme();

  const palette: Record<ButtonVariant, { bg: string; fg: ColorToken; border?: string }> = {
    primary: { bg: colors.surfaceInverse, fg: 'textOnDark' },
    secondary: { bg: colors.surfaceSubtle, fg: 'textPrimary' },
    ghost: { bg: 'transparent', fg: 'textPrimary', border: colors.borderDefault },
    danger: { bg: colors.dangerSurface, fg: 'danger' },
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
      {loading ? (
        <ActivityIndicator color={colors[look.fg]} />
      ) : (
        <>
          {icon ? <FontAwesome5 name={icon} size={14} color={colors[look.fg]} solid /> : null}
          <Text variant="bodySemiBold" color={look.fg}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
