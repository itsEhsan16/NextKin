import { View } from 'react-native';

import UsageArt from '../../../../assets/icons/billing/usage.svg';
import type { SubscriptionPlan, SubscriptionUsage } from '@/data/models';
import { Art, ProfileCard } from '@/features/profile/components/cards';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { ProgressBar } from '@/ui/Progress';
import { Text } from '@/ui/Text';

import {
  planPillLabel,
  publishedCaps,
  usageMeters,
  USAGE_TITLE,
  type UsageMeter,
  type UsageMeterKey,
} from '../upgradeCopy';
import { PlanPill } from './PlanPill';

export type PlanUsageCardProps = {
  usage: SubscriptionUsage;
  /** Decides how the per-document caps read: a Free cap, or Pro's "as often as you like". */
  plan: SubscriptionPlan;
  /** The allowance that sent the reader here; drawn on its own amber plate. */
  emphasis?: UsageMeterKey;
};

// BILLING 01 usage card at 390 (577:9182), in artboard units.
const HEADER_GAP = 10 / 0.75;
const ICON_SLOT_W = 34 / 0.75;
const ICON_SLOT_H = 26 / 0.75;
const ART_W = 30;
/** Header → meters → meters → rule → interview line: each about 6 on the board. */
const STACK_GAP = 6 / 0.75;
const METER_GAP = 8 / 0.75;
const METER_RADIUS = 12 / 0.75;
const METER_PAD_X = 10 / 0.75;
const METER_PAD_TOP = 8 / 0.75;
const METER_PAD_BOTTOM = 9 / 0.75;
const METER_BORDER = 0.75 / 0.75;
const LINE_GAP = 2 / 0.75;
const LABEL_TO_BAR = 7 / 0.75;
const BAR_HEIGHT = 5 / 0.75;
const RULE_INSET = 10 / 0.75;
const CAP_PAD_X = 10 / 0.75;

/** The bar chart drawing in the card's header (577:9184). */
const USAGE_ART: ListRowArt = { Icon: UsageArt, w: 30, h: 22.1761 };

function MeterTile({ row, lit }: { row: UsageMeter; lit: boolean }) {
  const { colors, s } = useTheme();
  const styles = useStyles();

  return (
    <View
      accessible
      accessibilityLabel={`${row.label}, ${row.line}`}
      style={[
        styles.meter,
        {
          borderColor: lit ? colors.warningBorder : 'transparent',
          backgroundColor: lit ? colors.warningSurface : 'transparent',
        },
      ]}
    >
      <Text variant="captionSemiBold" numberOfLines={1}>
        {row.label}
      </Text>
      <Text variant="micro" color="textSecondary" numberOfLines={1}>
        {`${row.line} ${row.period === 'day' ? 'today' : 'this month'}`}
      </Text>
      {/* Hidden from the reader: the line above already says the number, and a progressbar
          repeating it is a second stop that adds nothing. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.bar}
      >
        <ProgressBar
          value={row.fraction}
          height={s(BAR_HEIGHT)}
          trackColor={lit ? 'surfaceCard' : 'surfaceSubtle'}
          fillColor="warningAccent"
        />
      </View>
    </View>
  );
}

/**
 * V2 §13.5's live meter, drawn as BILLING 01's usage card (577:9182): what the allowances have
 * actually gone on, two to a row, said before any upsell argues for a bigger one. Every meter
 * names its published cap ("2 of 3 used"), never a bare percentage, and an allowance the account
 * does not meter is left out rather than drawn at zero.
 */
export function PlanUsageCard({ usage, plan, emphasis }: PlanUsageCardProps) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  const meters = usageMeters(usage);
  const caps = publishedCaps(usage, plan);

  if (meters.length === 0 && caps.length === 0) return null;

  // Two to a row (577:9198 / 577:9211); an odd one out keeps its half rather than stretching.
  const rows: UsageMeter[][] = [];
  for (let i = 0; i < meters.length; i += 2) rows.push(meters.slice(i, i + 2));

  return (
    <ProfileCard style={[styles.card, { padding: spacing[5] }]}>
      <View style={styles.header}>
        <View style={styles.iconSlot}>
          <Art art={USAGE_ART} width={ART_W} />
        </View>
        {/* The assistant's cap is daily, so the heading cannot say "This month" for every row. */}
        <Text {...a11yHeader(USAGE_TITLE)} variant="title" style={styles.grow}>
          {USAGE_TITLE}
        </Text>
        <PlanPill label={planPillLabel(plan)} />
      </View>

      {rows.map((pair) => (
        <View key={pair.map((row) => row.key).join('-')} style={styles.meterRow}>
          {pair.map((row) => (
            <MeterTile key={row.key} row={row} lit={row.key === emphasis} />
          ))}
          {pair.length === 1 ? <View style={styles.grow} /> : null}
        </View>
      ))}

      {/* Caps published per document rather than per period: a line, and no bar that would lie. */}
      {caps.length > 0 ? <View style={[styles.rule, { backgroundColor: colors.divider }]} /> : null}
      {caps.map((cap) => (
        <View
          key={cap.key}
          accessible
          accessibilityLabel={`${cap.label}, ${cap.line}`}
          style={styles.cap}
        >
          <Text variant="captionSemiBold" numberOfLines={1} style={styles.grow}>
            {cap.label}
          </Text>
          <Text variant="micro" color="textSecondary">
            {cap.line}
          </Text>
        </View>
      ))}
    </ProfileCard>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { gap: s(STACK_GAP) },
  header: { flexDirection: 'row', alignItems: 'center', gap: s(HEADER_GAP) },
  iconSlot: {
    width: s(ICON_SLOT_W),
    height: s(ICON_SLOT_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
  meterRow: { flexDirection: 'row', gap: s(METER_GAP) },
  meter: {
    flex: 1,
    gap: s(LINE_GAP),
    borderWidth: s(METER_BORDER),
    borderRadius: s(METER_RADIUS),
    paddingHorizontal: s(METER_PAD_X),
    paddingTop: s(METER_PAD_TOP),
    paddingBottom: s(METER_PAD_BOTTOM),
  },
  bar: { marginTop: s(LABEL_TO_BAR - LINE_GAP) },
  rule: { height: s(1), marginHorizontal: s(RULE_INSET) },
  cap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(METER_GAP),
    paddingHorizontal: s(CAP_PAD_X),
  },
}));
