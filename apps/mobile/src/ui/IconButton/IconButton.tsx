import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton, hitSlopFor } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Pressable, type PressHaptic } from '@/ui/Pressable';

export type IconButtonProps = {
  /** FontAwesome 5 Free glyph name. */
  icon: string;
  /** Solid (default) or Regular outline set. */
  iconStyle?: 'solid' | 'regular';
  iconSize?: number;
  /** Defaults to pure black — Figma draws the header glyphs (1:15 / 1:19) as #000000. */
  iconColor?: ColorToken;
  /** Accessible label — required; icon-only controls have no text. */
  label: string;
  /** Shows the 8px unread dot in the top-right (bell). */
  dot?: boolean;
  size?: number;
  /** Bordered circle (header) or flat (inline). */
  variant?: 'outline' | 'filled' | 'ghost';
  haptic?: PressHaptic;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** 48px circular icon control from the Home header (1px #e5e7eb ring, FA5 glyph). */
export function IconButton({
  icon,
  iconStyle = 'solid',
  iconSize = 16,
  iconColor = 'textBlack',
  label,
  dot = false,
  size = 48,
  variant = 'outline',
  haptic = 'light',
  onPress,
  disabled,
  style,
}: IconButtonProps) {
  const { colors, radii, sizes } = useTheme();

  const surface = {
    outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderDefault },
    filled: { backgroundColor: colors.surfaceSubtle, borderWidth: 0, borderColor: 'transparent' },
    ghost: { backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent' },
  }[variant];

  return (
    <Pressable
      {...a11yButton(label)}
      accessibilityState={{ disabled: !!disabled }}
      feedback="scale"
      haptic={haptic}
      hitSlop={hitSlopFor(size)}
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radii.full,
          alignItems: 'center',
          justifyContent: 'center',
        },
        surface,
        style,
      ]}
    >
      <FontAwesome5
        name={icon}
        size={iconSize}
        color={colors[iconColor]}
        solid={iconStyle === 'solid'}
      />
      {dot ? (
        <View
          style={{
            position: 'absolute',
            top: size / 4,
            right: size / 4,
            width: sizes.unreadDot,
            height: sizes.unreadDot,
            borderRadius: radii.full,
            backgroundColor: colors.dangerDot,
          }}
        />
      ) : null}
    </Pressable>
  );
}
