import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Text } from '@/ui/Text';

export type InsightCardProps = {
  title: string;
  /** One short line. */
  body?: string;
  icon?: LineIconName;
  /** Buttons or rows under the text. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The redesign's suggestion card (§172): a round brand icon, a title, one line, then actions.
 * White, radius 24, a soft lift — the "AI insight" pattern from the reference boards.
 */
export function InsightCard({ title, body, icon = 'Stars02', children, style }: InsightCardProps) {
  const { colors, radii, shadows, sizes, u } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceCard,
          borderRadius: radii.cardLg,
          borderWidth: sizes.border,
          borderColor: colors.borderSoft,
          padding: u(16),
          gap: u(14),
        },
        shadows.soft,
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', gap: u(12), alignItems: 'center' }}>
        <View
          style={{
            width: u(40),
            height: u(40),
            borderRadius: radii.full,
            backgroundColor: colors.brandSurface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size="md" color={colors.brand} />
        </View>
        <View style={{ flex: 1, gap: u(2) }}>
          <Text variant="title3">{title}</Text>
          {body ? (
            <Text variant="callout" color="textSecondary">
              {body}
            </Text>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}
