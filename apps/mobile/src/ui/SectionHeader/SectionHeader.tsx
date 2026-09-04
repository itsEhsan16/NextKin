import { View, type StyleProp, type ViewStyle } from 'react-native';

import { a11yButton, a11yHeader, hitSlopFor } from '@/lib';
import { useTheme, type TypographyRole } from '@/theme';
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
  const { spacing, s } = useTheme();
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
      <Text {...a11yHeader(title)} variant={variant} numberOfLines={1} style={{ flexShrink: 1 }}>
        {title}
      </Text>
      {onAction ? (
        <Pressable
          {...a11yButton(`${actionLabel} ${title}`)}
          feedback="subtle"
          haptic="selection"
          // The link is ~38pt tall on its own; 22 lifts the target to the 44pt minimum.
          hitSlop={hitSlopFor(s(22))}
          onPress={onAction}
        >
          <Text variant="viewAllLink" color="link">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
