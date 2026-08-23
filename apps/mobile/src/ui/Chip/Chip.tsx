import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type ChipTone = 'neutral' | 'brand' | 'success';

export type ChipProps = {
  label: string;
  tone?: ChipTone;
  style?: StyleProp<ViewStyle>;
};

/**
 * Static meta chip ("Full-time", "2d ago"). Figma: #f1f2f4 fill, r9, 14/4/6 padding,
 * 13px regular secondary text. Removable filter chips are a separate component (Phase 3).
 */
export function Chip({ label, tone = 'neutral', style }: ChipProps) {
  const { colors, radii } = useTheme();
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
          paddingHorizontal: 14,
          paddingTop: 4,
          paddingBottom: 6,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text variant="captionRegular" color={palette.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
