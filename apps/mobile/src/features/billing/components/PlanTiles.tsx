import { View } from 'react-native';

import FreePlanArt from '../../../../assets/icons/billing/free-plan.svg';
import ProPlanArt from '../../../../assets/icons/billing/pro-plan.svg';
import type { Plan, SubscriptionPlan } from '@/data/models';
import { Art, ProfileCard } from '@/features/profile/components/cards';
import { scaledSheet, useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Text } from '@/ui/Text';

import { formatPlanPricePeriod, planPriceParts } from '../upgradeCopy';
import { PlanPill } from './PlanPill';

export type PlanTilesProps = {
  free: Plan;
  /** The Pro SKU the billing-period control currently selects. */
  pro: Plan;
  /** The tier the reader is actually on; its tile is marked and never sold. */
  current: SubscriptionPlan;
  /** "Save ₹9,989 a year — 55% less than paying monthly.", when the annual SKU is selected. */
  savingLine?: string;
};

export const CURRENT_PLAN_CHIP = 'Your plan';

// BILLING 01 plan cards at 390 (577:9239 Free, 577:9259 Pro), in artboard units.
const TILE_GAP = 10 / 0.75;
const ROW_GAP = 12 / 0.75;
const ICON_SLOT_W = 44 / 0.75;
const ICON_SLOT_H = 38 / 0.75;
const ART_W = 40;
const TEXT_GAP = 4 / 0.75;
const TITLE_GAP = 8 / 0.75;
const PRICE_GAP = 2 / 0.75;
/** The selected card's brand line (577:9259) — twice the hairline every other card wears. */
const ACCENT_BORDER = 1.5 / 0.75;

/** The rosette (577:9240) and the crown (577:9260). */
const FREE_ART: ListRowArt = { Icon: FreePlanArt, w: 40, h: 32.3069 };
const PRO_ART: ListRowArt = { Icon: ProPlanArt, w: 40, h: 32.4917 };

type TileProps = {
  plan: Plan;
  mine: boolean;
  accent: boolean;
  savingLine?: string;
};

function PlanTile({ plan, mine, accent, savingLine }: TileProps) {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();
  const paid = plan.price.amount > 0;
  const { figure, suffix } = planPriceParts(plan.price);
  // "Free, Free" is what the composed reading would otherwise be: the tile's name and its price
  // are the same word on the free plan, so the spoken price says what it means instead.
  const spokenPrice = paid ? formatPlanPricePeriod(plan.price) : 'no charge';

  return (
    <ProfileCard
      style={[
        { padding: spacing[5] },
        accent
          ? {
              borderWidth: s(ACCENT_BORDER),
              borderColor: colors.brand,
              backgroundColor: colors.brandSurface,
            }
          : null,
      ]}
    >
      <View
        accessible
        accessibilityLabel={`${plan.name}, ${spokenPrice}${mine ? ', your current plan' : ''}. ${plan.blurb}`}
        style={styles.row}
      >
        <View style={styles.iconSlot}>
          <Art art={plan.tier === 'pro' ? PRO_ART : FREE_ART} width={ART_W} />
        </View>

        <View style={styles.text}>
          <View style={styles.titleRow}>
            <Text variant="title" style={styles.name} numberOfLines={1}>
              {plan.name}
            </Text>
            {mine ? <PlanPill label={CURRENT_PLAN_CHIP} /> : null}
            {!mine && plan.badge ? <PlanPill label={plan.badge} tone="brand" /> : null}
          </View>

          {/* The free card states no price (577:9239): its name already says it. */}
          {paid ? (
            <View style={styles.price}>
              <Text variant="displayLg">{figure}</Text>
              <Text variant="caption" color="textSecondary">
                {suffix}
              </Text>
            </View>
          ) : null}

          <Text variant="micro" color="textSecondary">
            {plan.blurb}
          </Text>
          {savingLine ? (
            <Text variant="microBadge" color="brand">
              {savingLine}
            </Text>
          ) : null}
        </View>
      </View>
    </ProfileCard>
  );
}

/**
 * The two SKUs on offer, stacked as BILLING 01 draws them: Free plain, the Pro SKU the period
 * control selects on a brand line and lavender wash.
 *
 * Neither tile is pressable. The billing-period control above chooses the Pro SKU and the sticky
 * bar buys it, so a tile that also handled a press would be a second, quieter way to spend money
 * — and the plan the reader is already on has nothing to press at all.
 */
export function PlanTiles({ free, pro, current, savingLine }: PlanTilesProps) {
  const styles = useStyles();

  return (
    <View style={styles.stack}>
      <PlanTile plan={free} mine={current === 'free'} accent={false} />
      <PlanTile
        plan={pro}
        mine={current === 'pro'}
        accent={current !== 'pro'}
        savingLine={savingLine}
      />
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  stack: { gap: s(TILE_GAP) },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: s(ROW_GAP) },
  iconSlot: {
    width: s(ICON_SLOT_W),
    height: s(ICON_SLOT_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: s(TEXT_GAP) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: s(TITLE_GAP) },
  name: { flexShrink: 1 },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: s(PRICE_GAP) },
}));
