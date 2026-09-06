import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';

import { REASON_LINE } from '../upgradeCopy';
import type { UpgradeReason } from '../upgradeReasons';

export type PlanReasonBannerProps = { reason: UpgradeReason };

const TILE = 36;
const GLYPH = 15;

/**
 * V2 §13.5 — the screen opens on the limit that was actually reached rather than on a pitch. A
 * reader who arrived with no reason (the plan row on Profile, say) gets no banner at all: an
 * invented generic line would be a claim nobody made.
 */
export function PlanReasonBanner({ reason }: PlanReasonBannerProps) {
  const { colors, radii, spacing, s } = useTheme();

  return (
    <Card
      radius="card"
      elevated={false}
      style={{ backgroundColor: colors.brandSurface, borderColor: colors.brandSurface }}
    >
      <View style={[styles.row, { gap: spacing[3] }]}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.tile,
            {
              width: s(TILE),
              height: s(TILE),
              borderRadius: radii.md,
              backgroundColor: colors.surfaceCard,
            },
          ]}
        >
          <FontAwesome5 name="lock" size={s(GLYPH)} color={colors.brand} solid />
        </View>
        <Text variant="bodyMedium" style={styles.line}>
          {REASON_LINE[reason]}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tile: { alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1 },
});
