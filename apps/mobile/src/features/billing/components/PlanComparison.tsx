import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { StyleSheet, View } from 'react-native';

import { PLAN_FEATURES, type PlanFeature } from '@/data/models';
import { useTheme } from '@/theme';
import { RowGroup } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

import { featureRowLabel, planCell, FREE_COLUMN, PRO_COLUMN, type PlanCell } from '../upgradeCopy';

const ROW_PADDING = 20;
const ROW_GAP = 12;
const GLYPH = 13;

function Cell({ cell, pro }: { cell: PlanCell; pro: boolean }) {
  const { colors, s } = useTheme();

  // Only a genuine yes or no becomes a glyph. Every other cell is a published cap (V2 §13.1), and
  // a tick in place of "3 / month" would hide the number the spec insists on printing.
  if (cell.kind === 'yes') {
    return <FontAwesome5 name="check" size={s(GLYPH)} color={colors.success} solid />;
  }
  if (cell.kind === 'no') {
    return <FontAwesome5 name="minus" size={s(GLYPH)} color={colors.iconMuted} solid />;
  }
  if (cell.kind === 'locked') {
    return (
      <View style={[styles.locked, { gap: s(6) }]}>
        <FontAwesome5 name="lock" size={s(GLYPH - 2)} color={colors.iconMuted} solid />
        <Text variant="microSemiBold" color="textSecondary" numberOfLines={2}>
          {cell.text}
        </Text>
      </View>
    );
  }
  return (
    <Text
      variant="captionRegular"
      color={pro ? 'textPrimary' : 'textSecondary'}
      align="center"
      numberOfLines={2}
    >
      {cell.text}
    </Text>
  );
}

function FeatureRow({ feature }: { feature: PlanFeature }) {
  const { spacing, s } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={featureRowLabel(feature)}
      style={[
        styles.row,
        { paddingHorizontal: s(ROW_PADDING), paddingVertical: spacing[3], gap: s(ROW_GAP) },
      ]}
    >
      <Text variant="rowDescription" style={styles.label}>
        {feature.label}
      </Text>
      <View style={styles.cell}>
        <Cell cell={planCell(feature.free, feature.lockedOnFree)} pro={false} />
      </View>
      <View style={styles.cell}>
        <Cell cell={planCell(feature.pro)} pro />
      </View>
    </View>
  );
}

/**
 * The V2 §13.3 gating table, rendered from `PLAN_FEATURES` rather than retyped: the caps are
 * published copy, and a second hand-written copy of them is how an app ends up advertising a
 * limit it does not enforce.
 */
export function PlanComparison() {
  const { spacing, s } = useTheme();

  const header = (
    <View
      key="header"
      accessible
      accessibilityRole="header"
      accessibilityLabel={`Plan comparison, ${FREE_COLUMN} and ${PRO_COLUMN}`}
      style={[
        styles.row,
        { paddingHorizontal: s(ROW_PADDING), paddingVertical: spacing[3], gap: s(ROW_GAP) },
      ]}
    >
      <View style={styles.label} />
      <View style={styles.cell}>
        <Text variant="overline" color="textSecondary" align="center">
          {FREE_COLUMN}
        </Text>
      </View>
      <View style={styles.cell}>
        <Text variant="overline" align="center">
          {PRO_COLUMN}
        </Text>
      </View>
    </View>
  );

  return (
    <RowGroup title="WHAT YOU GET">
      {[
        header,
        ...PLAN_FEATURES.map((feature) => <FeatureRow key={feature.key} feature={feature} />),
      ]}
    </RowGroup>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1.4 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  locked: { flexDirection: 'row', alignItems: 'center' },
});
