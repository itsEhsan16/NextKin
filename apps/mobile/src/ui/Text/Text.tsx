import { useMemo } from 'react';
import {
  Text as RNText,
  StyleSheet,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { maxFontScale } from '@/lib';
import { useTheme, type ColorToken, type TypographyRole } from '@/theme';

/** Dense chrome roles must not scale unboundedly with Dynamic Type. */
const CHROME_ROLES: ReadonlySet<TypographyRole> = new Set(['tabLabel', 'badge', 'micro']);

export type TextProps = Omit<RNTextProps, 'style'> & {
  /** Typography variant from the Figma type ramp. Defaults to `body`. RN's `role` stays the ARIA role. */
  variant?: TypographyRole;
  /** Semantic colour token. Defaults to `textPrimary`. */
  color?: ColorToken;
  align?: TextStyle['textAlign'];
  /** Escape hatch for layout-only overrides (margins, flex). Never use it for font or colour. */
  style?: RNTextProps['style'];
};

/**
 * The only text primitive in the app. Maps a typography variant + colour token to styles so
 * screens never pick font sizes or hex values themselves.
 */
export function Text({
  variant = 'body',
  color = 'textPrimary',
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const theme = useTheme();

  const roleStyle = useMemo<TextStyle>(
    () => ({
      ...theme.typography[variant],
      color: theme.colors[color],
      ...(align ? { textAlign: align } : {}),
    }),
    [theme, variant, color, align],
  );

  const fontScale =
    maxFontSizeMultiplier ?? (CHROME_ROLES.has(variant) ? maxFontScale.chrome : maxFontScale.body);

  return (
    <RNText {...rest} maxFontSizeMultiplier={fontScale} style={[styles.base, roleStyle, style]} />
  );
}

const styles = StyleSheet.create({
  base: {
    // Android adds font padding above/below glyphs; Figma line heights assume it is off.
    includeFontPadding: false,
  },
});
