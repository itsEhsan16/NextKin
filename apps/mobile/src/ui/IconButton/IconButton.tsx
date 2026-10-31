import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton, hitSlopFor } from '@/lib';
import { useTheme, type ColorToken } from '@/theme';
import { Icon, type IconSize, type LineIconName } from '@/ui/Icon';
import { Pressable, type PressHaptic } from '@/ui/Pressable';

export type IconButtonProps = {
  /** Untitled UI line icon, the set the web app uses. */
  icon: LineIconName;
  /** Defaults to `md`, the web's size for an icon that stands alone. */
  iconSize?: IconSize;
  /** Fills the glyph — the saved state of a bookmark. */
  iconFilled?: boolean;
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

/** 48px circular icon control from the Home header (1px #e5e7eb ring, line glyph). */
export function IconButton({
  icon,
  iconSize = 'md',
  iconFilled = false,
  iconColor = 'textBlack',
  label,
  dot = false,
  size,
  variant = 'outline',
  haptic = 'light',
  onPress,
  disabled,
  style,
}: IconButtonProps) {
  const { colors, radii, sizes } = useTheme();
  const box = size ?? sizes.iconButton;

  const surface = {
    outline: {
      backgroundColor: 'transparent',
      borderWidth: sizes.border,
      borderColor: colors.borderDefault,
    },
    filled: { backgroundColor: colors.surfaceSubtle, borderWidth: 0, borderColor: 'transparent' },
    ghost: { backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent' },
  }[variant];

  return (
    <Pressable
      {...a11yButton(label)}
      accessibilityState={{ disabled: !!disabled }}
      feedback="scale"
      haptic={haptic}
      hitSlop={hitSlopFor(box)}
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          width: box,
          height: box,
          borderRadius: radii.full,
          alignItems: 'center',
          justifyContent: 'center',
        },
        surface,
        style,
      ]}
    >
      <Icon name={icon} size={iconSize} color={colors[iconColor]} filled={iconFilled} />
      {dot ? (
        <View
          style={{
            position: 'absolute',
            top: box / 4,
            right: box / 4,
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
