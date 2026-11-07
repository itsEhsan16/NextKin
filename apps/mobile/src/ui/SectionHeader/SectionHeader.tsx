import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton, a11yHeader, hitSlopFor } from '@/lib';
import { useTheme, type TypographyRole } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type SectionHeaderProps = {
  title: string;
  /** Figma mixes weights per section; default is the 19px regular used by "Top Job Matches". */
  variant?: Extract<TypographyRole, 'section' | 'homeSection'>;
  /** Trailing link ("View all"). Rendered only when `onAction` is set. */
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Section title row with an optional trailing text link. */
export function SectionHeader({
  title,
  variant = 'section',
  actionLabel = 'View all',
  onAction,
  style,
}: SectionHeaderProps) {
  const { colors, spacing, s } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing[3],
        },
        style,
      ]}
    >
      {/* Every section reads as the redesign's title3 (§176); `variant` is kept for callers. */}
      <Text {...a11yHeader(title)} variant="title3" numberOfLines={1} style={{ flexShrink: 1 }}>
        {title}
      </Text>
      {onAction ? (
        <Pressable
          {...a11yButton(`${actionLabel} ${title}`)}
          feedback="subtle"
          // The link is ~38pt tall on its own; 22 lifts the target to the 44pt minimum.
          hitSlop={hitSlopFor(s(22))}
          onPress={onAction}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(2) }}>
            <Text variant="footnote" color="brand">
              {actionLabel}
            </Text>
            <Icon name="ChevronRight" size={s(14)} color={colors.brand} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
