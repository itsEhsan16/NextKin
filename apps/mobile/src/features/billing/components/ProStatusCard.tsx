import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';

import { MANAGE_NOTE, PRO_TITLE } from '../upgradeCopy';

export type ProStatusCardProps = {
  /** "Renews on 12 Oct", or nothing when the subscription carries no renewal date. */
  renewal?: string;
};

const TILE = 44;
const GLYPH = 18;

/**
 * What the plan screen becomes once there is nothing to sell. A reader already on Pro is shown
 * where they stand and how to change it — never a second pitch for the plan they are paying for.
 */
export function ProStatusCard({ renewal }: ProStatusCardProps) {
  const { colors, radii, spacing, s } = useTheme();

  return (
    <Card radius="card">
      <View style={[styles.row, { gap: spacing[4] }]}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.tile,
            {
              width: s(TILE),
              height: s(TILE),
              borderRadius: radii.md,
              backgroundColor: colors.brandSurface,
            },
          ]}
        >
          <FontAwesome5 name="check" size={s(GLYPH)} color={colors.brand} solid />
        </View>
        <View style={[styles.copy, { gap: spacing[1] }]}>
          <Text variant="title">{PRO_TITLE}</Text>
          <Text variant="caption" color="textSecondary">
            {renewal ?? MANAGE_NOTE}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tile: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
});
