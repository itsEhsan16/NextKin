import { View, type StyleProp, type ViewStyle } from 'react-native';

import SparkleIcon from '../../../assets/icons/ai-sparkle.svg';
import { useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type AiBadgeProps = {
  label?: string;
  style?: StyleProp<ViewStyle>;
};

const SPARKLE = 10;

/**
 * "✦ AI" pill marking AI-powered actions (Figma 1:1179 / 1:1187): brand-tinted surface,
 * fully rounded, 8/9 horizontal padding.
 */
export function AiBadge({ label = 'AI', style }: AiBadgeProps) {
  const { colors, radii, s } = useTheme();

  return (
    // Not accessible on its own: SheetRow folds "AI powered" into the row's label, and a nested
    // accessible node would make TalkBack announce it a second time.
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(4),
          paddingLeft: s(8),
          paddingRight: s(9),
          paddingVertical: s(4),
          borderRadius: radii.full,
          backgroundColor: colors.brandSurface,
        },
        style,
      ]}
    >
      <SparkleIcon width={s(SPARKLE)} height={s(SPARKLE)} color={colors.brand} />
      <Text variant="badge" color="brand">
        {label}
      </Text>
    </View>
  );
}
