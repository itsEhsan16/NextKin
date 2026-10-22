import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

export type AssistantUsageProps = {
  /** Messages already sent today. */
  used: number;
  /** Today's cap. A non-positive limit means "nothing to meter" and renders nothing. */
  limit: number;
};

// ASSISTANT 01 at 390 (577:6498), in artboard units.
const PAD = 14;
const GAP = 8;
const RADIUS = 15;
const BAR_H = 6;

/**
 * "Messages · 8 of 20 left today" over the amber bar (ASSISTANT 01 577:6498). §7.16 and §13.5
 * want the cap on screen before it is hit, in the cap's own period. The bar is hidden from the
 * reader: the line above it already says the number.
 */
export function AssistantUsage({ used, limit }: AssistantUsageProps) {
  const { s } = useTheme();
  const styles = useStyles();

  if (limit <= 0) return null;
  const left = Math.max(0, limit - used);

  return (
    <Card shadow="jobCard" padding={s(PAD / 0.75)} style={styles.card}>
      <View
        style={styles.row}
        accessible
        accessibilityLabel={`Messages: ${left} of ${limit} left today`}
      >
        <Text variant="bodySemiBold" style={styles.grow}>
          Messages
        </Text>
        <Text variant="caption" color="textSecondary">
          {`${left} of ${limit} left today`}
        </Text>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ProgressBar
          value={used / limit}
          height={s(BAR_H / 0.75)}
          trackColor="surfaceSubtle"
          fillColor="warningAccent"
        />
      </View>
    </Card>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { borderRadius: s(RADIUS / 0.75), gap: s(GAP / 0.75) },
  row: { flexDirection: 'row', alignItems: 'center', gap: s(8 / 0.75) },
  grow: { flex: 1 },
}));
