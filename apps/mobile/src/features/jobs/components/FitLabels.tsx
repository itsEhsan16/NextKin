import { View } from 'react-native';

import type { FitLabel, FitState } from '@/data/models';
import { scaledSheet, useTheme, type ColorToken } from '@/theme';
import { Card } from '@/ui/Card';
import { Icon, type LineIconName } from '@/ui/Icon';
import { Text } from '@/ui/Text';

export const FIT_TITLE = 'Against your preferences';

const LOOK: Record<FitState, { icon: LineIconName; color: ColorToken }> = {
  fits: { icon: 'CheckCircle', color: 'success' },
  clashes: { icon: 'AlertTriangle', color: 'warningStrong' },
  unknown: { icon: 'HelpCircle', color: 'textSecondary' },
};

/**
 * How a job sits with where, how and for how much the candidate wants to work (owner, 2026-11-01,
 * toreview §147.3). It sits under the skills match and stays separate from it: the match is about
 * skills, and these only say what the listing states. Spec-derived; no artboard draws it.
 */
export function FitLabels({ labels }: { labels: FitLabel[] }) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  if (labels.length === 0) return null;
  return (
    <Card radius="card">
      <View style={{ gap: spacing[3] }}>
        <Text variant="title" accessibilityRole="header">
          {FIT_TITLE}
        </Text>
        {labels.map((label) => {
          const look = LOOK[label.state];
          return (
            <View key={label.kind} style={[styles.row, { gap: spacing[2] }]}>
              <Icon name={look.icon} size="sm" color={colors[look.color]} />
              <Text variant="body" color="textBody" style={styles.text}>
                {label.text}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const useStyles = scaledSheet(() => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
}));
