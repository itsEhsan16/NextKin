import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type radii, type shadows } from '@/theme';

export type CardProps = {
  /** Corner radius token. Defaults to `cardLg` (24) — the Home card style. */
  radius?: keyof typeof radii;
  /** Inner padding in spacing units (px). Defaults to 16. */
  padding?: number;
  /** Figma: 1px #f3f4f6 hairline + a shadow (see `shadow`). */
  elevated?: boolean;
  /** Which shadow `elevated` draws. Defaults to `card` (0 1 2); the Jobs cards use `jobCard` (0 1 1). */
  shadow?: keyof typeof shadows;
  /**
   * The card holds a skeleton (§196): it keeps its size but draws no border and no shadow, so the
   * placeholder never sits in a framed box — Android's elevation gives it a hard dark edge.
   */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Surface card used by every Home section, job card and resume row. */
export function Card({
  radius = 'cardLg',
  padding,
  elevated = true,
  // The redesign's soft lift (§176); `card` and `jobCard` stay available by name.
  shadow = 'soft',
  loading = false,
  style,
  children,
}: CardProps) {
  const { colors, radii: r, shadows: shadowTokens, spacing, s } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceCard,
          borderRadius: r[radius],
          borderWidth: s(1),
          borderColor: loading ? 'transparent' : colors.borderSoft,
          padding: padding ?? spacing[4],
        },
        elevated && !loading ? shadowTokens[shadow] : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
