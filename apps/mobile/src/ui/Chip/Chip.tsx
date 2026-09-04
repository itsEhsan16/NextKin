import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type TypographyRole } from '@/theme';
import { Text } from '@/ui/Text';

export type ChipTone = 'neutral' | 'brand' | 'success';

export type ChipProps = {
  label: string;
  tone?: ChipTone;
  /**
   * Both boards draw this chip at 13pt, but the 390 board draws Home's pair inside a 216pt card
   * a step smaller than the ones on Job Detail — `homeCardChip` against the shared `caption`.
   */
  labelVariant?: TypographyRole;
  style?: StyleProp<ViewStyle>;
};

/**
 * Static meta chip ("Full-time", "2d ago"). Figma: #f1f2f4 fill, r9, 14/4/6 padding,
 * 13px regular secondary text. Removable filter chips are a separate component (Phase 3).
 */
export function Chip({ label, tone = 'neutral', labelVariant = 'captionRegular', style }: ChipProps) {
  const { colors, radii, s } = useTheme();
  const palette = {
    neutral: { bg: colors.surfaceSubtle, fg: 'textSecondary' as const },
    brand: { bg: colors.brandSurface, fg: 'brand' as const },
    success: { bg: colors.successSurface, fg: 'success' as const },
  }[tone];

  return (
    <View
      style={[
        {
          backgroundColor: palette.bg,
          borderRadius: radii.sm,
          paddingHorizontal: s(14),
          paddingTop: s(4),
          paddingBottom: s(6),
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text variant={labelVariant} color={palette.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
