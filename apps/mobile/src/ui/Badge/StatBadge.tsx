import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type StatBadgeTone = 'success' | 'brand' | 'neutral' | 'warning';

export type StatBadgeProps = {
  /** Big value line ("98%"). */
  value: string;
  /** Small caption under the value ("Match"). */
  label: string;
  tone?: StatBadgeTone;
  style?: StyleProp<ViewStyle>;
};

/** Two-line stat pill from the job match card: tinted surface, r12, 12/3/4 padding. */
export function StatBadge({ value, label, tone = 'success', style }: StatBadgeProps) {
  const { colors, radii } = useTheme();
  const palette = {
    success: { bg: colors.successSurface, fg: 'success' as const },
    brand: { bg: colors.brandSurface, fg: 'brand' as const },
    neutral: { bg: colors.surfaceSubtle, fg: 'textSecondary' as const },
    warning: { bg: colors.warningSurface, fg: 'warning' as const },
  }[tone];

  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      style={[
        {
          backgroundColor: palette.bg,
          borderRadius: radii.md,
          paddingHorizontal: 12,
          paddingTop: 3,
          paddingBottom: 4,
          alignItems: 'center',
        },
        style,
      ]}
    >
      <Text variant="body" color={palette.fg} style={{ marginBottom: -1 }}>
        {value}
      </Text>
      <Text variant="microRegular" color={palette.fg}>
        {label}
      </Text>
    </View>
  );
}
