import { View } from 'react-native';

import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { FlowCard } from '@/ui/kit';
import { Text } from '@/ui/Text';

export type ScoreNotMeasuredProps = { lines: readonly string[] };

/**
 * "What this doesn't measure" (V2 §7.8, toreview §146.1): the engine's list, beside every score.
 * A quiet flat card since §177, so it reads as the score's small print.
 */
export function ScoreNotMeasured({ lines }: ScoreNotMeasuredProps) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Icon name="InfoCircle" size={u(18)} color={colors.textSecondary} />
        <Text {...a11yHeader()} variant="title3" color="ink">
          What this doesn’t measure
        </Text>
      </View>
      <FlowCard flat style={[styles.card, { backgroundColor: colors.surfaceSubtle }]}>
        {lines.map((line) => (
          <View key={line} style={styles.line}>
            <Text variant="callout" color="textSecondary">
              •
            </Text>
            <Text variant="callout" color="textSecondary" style={styles.flex}>
              {line}
            </Text>
          </View>
        ))}
      </FlowCard>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(12) },
  head: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  card: { gap: u(10), borderWidth: 0 },
  line: { flexDirection: 'row', gap: u(8) },
  flex: { flex: 1 },
}));
