import { Fragment } from 'react';
import { View } from 'react-native';

import { PLAN_FEATURES, type PlanFeature } from '@/data/models';
import { ProfileCard } from '@/features/profile/components/cards';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

import {
  COMPARISON_TITLE,
  featureRowLabel,
  planCell,
  FREE_COLUMN,
  PRO_COLUMN,
  type PlanCell,
} from '../upgradeCopy';
import { Icon } from '@/ui/Icon';

// BILLING 01 "What you get" at 390 (577:9276), in artboard units.
const PAD_LEFT = 14 / 0.75;
const PAD_RIGHT = 8 / 0.75;
const COL_GAP = 6 / 0.75;
const FREE_W = 94 / 0.75;
const PRO_W = 102 / 0.75;
const HEADER_PAD_TOP = 12 / 0.75;
const HEADER_PAD_BOTTOM = 8 / 0.75;
const ROW_PAD_Y = 6 / 0.75;
const FOOT = 4 / 0.75;
const LOCK_GAP = 4 / 0.75;
/** The lavender band behind the Pro column (577:9395), inset from the card's inner edge. */
const BAND_INSET = 4.25 / 0.75;
const BAND_W = 108 / 0.75;
const BAND_RADIUS = 12 / 0.75;

function Cell({ cell, pro }: { cell: PlanCell; pro: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();

  // Only a genuine yes or no becomes a glyph. Every other cell is a published cap (V2 §13.1), and
  // a tick in place of "3 / month" would hide the number the spec insists on printing.
  if (cell.kind === 'yes') {
    return <Icon name="CheckCircle" size="sm" color={colors.glyphSuccess} />;
  }
  if (cell.kind === 'no') {
    return <Icon name="Minus" size="lg" color={colors.iconMuted} />;
  }
  if (cell.kind === 'locked') {
    return (
      <View style={styles.locked}>
        <Icon name="Lock01" size="xs" color={colors.iconMuted} />
        <Text variant="microBadge" color="textSecondary" numberOfLines={1}>
          {cell.text}
        </Text>
      </View>
    );
  }
  return (
    <Text
      variant={pro ? 'microBadge' : 'microRegular'}
      color={pro ? 'textPrimary' : 'textSecondary'}
      align="center"
      numberOfLines={2}
    >
      {cell.text}
    </Text>
  );
}

function FeatureRow({ feature }: { feature: PlanFeature }) {
  const styles = useStyles();

  return (
    <View
      accessible
      accessibilityLabel={featureRowLabel(feature)}
      style={[styles.row, styles.featureRow]}
    >
      <Text variant="micro" style={styles.label}>
        {feature.label}
      </Text>
      <View style={[styles.cell, styles.freeCell]}>
        <Cell cell={planCell(feature.free, feature.lockedOnFree)} pro={false} />
      </View>
      <View style={[styles.cell, styles.proCell]}>
        <Cell cell={planCell(feature.pro)} pro />
      </View>
    </View>
  );
}

/**
 * The V2 §13.3 gating table, drawn as BILLING 01's "What you get" card (577:9276): the Pro column
 * set on a lavender band, one hairline between rows. Rendered from `PLAN_FEATURES` rather than
 * retyped: the caps are published copy, and a second hand-written copy of them is how an app ends
 * up advertising a limit it does not enforce.
 */
export function PlanComparison() {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <ProfileCard style={styles.card}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.band, { backgroundColor: colors.brandSurface }]}
      />

      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${COMPARISON_TITLE}: ${FREE_COLUMN} and ${PRO_COLUMN} compared`}
        style={[styles.row, styles.header]}
      >
        <Text variant="title" style={styles.label}>
          {COMPARISON_TITLE}
        </Text>
        <View style={[styles.cell, styles.freeCell]}>
          <Text variant="overline" color="textSecondary" align="center">
            {FREE_COLUMN.toUpperCase()}
          </Text>
        </View>
        <View style={[styles.cell, styles.proCell]}>
          <Text variant="overline" color="brand" align="center">
            {PRO_COLUMN.toUpperCase()}
          </Text>
        </View>
      </View>

      {PLAN_FEATURES.map((feature, index) => (
        <Fragment key={feature.key}>
          {index > 0 ? <View style={[styles.rule, { backgroundColor: colors.divider }]} /> : null}
          <FeatureRow feature={feature} />
        </Fragment>
      ))}
    </ProfileCard>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { paddingBottom: s(FOOT), overflow: 'hidden' },
  band: {
    position: 'absolute',
    top: s(BAND_INSET),
    bottom: s(BAND_INSET),
    right: s(BAND_INSET),
    width: s(BAND_W),
    borderRadius: s(BAND_RADIUS),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(COL_GAP),
    paddingLeft: s(PAD_LEFT),
    paddingRight: s(PAD_RIGHT),
  },
  header: { paddingTop: s(HEADER_PAD_TOP), paddingBottom: s(HEADER_PAD_BOTTOM) },
  featureRow: { paddingVertical: s(ROW_PAD_Y) },
  label: { flex: 1 },
  cell: { alignItems: 'center', justifyContent: 'center' },
  freeCell: { width: s(FREE_W) },
  proCell: { width: s(PRO_W) },
  locked: { flexDirection: 'row', alignItems: 'center', gap: s(LOCK_GAP) },
  rule: { height: s(1), marginLeft: s(PAD_LEFT), marginRight: s(PAD_RIGHT) },
}));
