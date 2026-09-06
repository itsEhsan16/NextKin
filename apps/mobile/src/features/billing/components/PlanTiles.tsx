import { StyleSheet, View } from 'react-native';

import type { Plan, SubscriptionPlan } from '@/data/models';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Text } from '@/ui/Text';

import { formatPlanPricePeriod } from '../upgradeCopy';

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

type TileProps = {
  plan: Plan;
  mine: boolean;
  accent: boolean;
  savingLine?: string;
};

function PlanTile({ plan, mine, accent, savingLine }: TileProps) {
  const { colors, spacing } = useTheme();
  const price = formatPlanPricePeriod(plan.price);
  // "Free, Free" is what the composed reading would otherwise be: the tile's name and its price
  // are the same word on the free plan, so the spoken price says what it means instead.
  const spokenPrice = plan.price.amount <= 0 ? 'no charge' : price;

  return (
    <Card radius="card" style={accent ? { borderColor: colors.brand } : null}>
      <View
        accessible
        accessibilityLabel={`${plan.name}, ${spokenPrice}${mine ? ', your current plan' : ''}. ${plan.blurb}`}
        style={{ gap: spacing[2] }}
      >
        <View style={[styles.row, { gap: spacing[2] }]}>
          <Text variant="title" style={styles.name} numberOfLines={1}>
            {plan.name}
          </Text>
          {mine ? <Chip label={CURRENT_PLAN_CHIP} /> : null}
          {!mine && plan.badge ? <Chip label={plan.badge} tone="success" /> : null}
        </View>

        <Text variant="display">{price}</Text>
        <Text variant="caption" color="textSecondary">
          {plan.blurb}
        </Text>
        {savingLine ? (
          <Text variant="captionSemiBold" color="brand">
            {savingLine}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * The two SKUs on offer, stacked rather than set side by side: at 390dp two columns leave each
 * price and blurb about 150dp to live in, and the blurb is the half that carries what the plan
 * actually grants.
 *
 * Neither tile is pressable. The billing-period control above chooses the Pro SKU and the sticky
 * bar buys it, so a tile that also handled a press would be a second, quieter way to spend money
 * — and the plan the reader is already on has nothing to press at all.
 */
export function PlanTiles({ free, pro, current, savingLine }: PlanTilesProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing[3] }}>
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { flexShrink: 1 },
});
