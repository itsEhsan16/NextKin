import { View } from 'react-native';

import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { IconTile } from '@/ui/kit';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export const APPLICATIONS_CARD_TITLE = 'Your applications';

export type ApplicationsCardProps = {
  /** "5 applied · 1 interview · 2 to check on". */
  line: string;
  onPress: () => void;
};

/**
 * Where a search stands (owner, 2026-11-01, toreview §147.1): what's next, with no streaks or
 * targets, so a slow search doesn't read as a falling score. Spec-derived; it appears after a first
 * application, and Home's board doesn't draw it.
 */
export function ApplicationsCard({ line, onPress }: ApplicationsCardProps) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton(`${APPLICATIONS_CARD_TITLE}: ${line}`, 'Opens your applications')}
      feedback="scale"
      haptic="light"
      onPress={onPress}
    >
      <Card>
        <View style={[styles.row, { gap: spacing[3] }]}>
          <IconTile name="Briefcase01" size={44} />
          <View style={[styles.text, { gap: spacing[1] }]}>
            <Text variant="bodyLgStrong" color="ink">
              {APPLICATIONS_CARD_TITLE}
            </Text>
            <Text variant="footnote" color="textSecondary">
              {line}
            </Text>
          </View>
          <Icon name="ChevronRight" size="sm" color={colors.iconChevron} />
        </View>
      </Card>
    </Pressable>
  );
}

const useStyles = scaledSheet(() => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
}));
