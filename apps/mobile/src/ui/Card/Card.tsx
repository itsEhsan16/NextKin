import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type radii } from '@/theme';

export type CardProps = {
  /** Corner radius token. Defaults to `cardLg` (24) — the Home card style. */
  radius?: keyof typeof radii;
  /** Inner padding in spacing units (px). Defaults to 16. */
  padding?: number;
  /** Figma: 1px #f3f4f6 hairline + `0 1 2 rgba(0,0,0,.05)` shadow. */
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Surface card used by every Home section, job card and resume row. */
export function Card({ radius = 'cardLg', padding, elevated = true, style, children }: CardProps) {
  const { colors, radii: r, shadows, spacing } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceCard,
          borderRadius: r[radius],
          borderWidth: 1,
          borderColor: colors.borderHairline,
          padding: padding ?? spacing[4],
        },
        elevated ? shadows.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
