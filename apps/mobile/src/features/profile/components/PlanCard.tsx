import { View } from 'react-native';

import PlanMarkIcon from '../../../../assets/icons/profile/plan-mark.svg';
import { SUBSCRIPTION_PLAN_LABEL, type Subscription } from '@/data/models';
import { a11yButton } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

export type PlanCardProps = {
  subscription: Subscription;
  /**
   * Called with nothing. The card names no limit, so the plans page opens without a reason; the
   * press event once rode through to `openUpgrade(reason?)` and arrived as the reason (§85).
   */
  onUpgrade: () => void;
};

/**
 * The plan mark (Figma 430:48) replaced the lavender sparkle tile: 39 × 40.53 at 390, 9 in from
 * the card's left edge and 6.75 short of the text — 52 × 54, 12 and 9 in artboard units. The
 * card keeps its 72 height, so the mark leaves 9 above and below.
 */
const MARK = { w: 39 / 0.75, h: 40.5294 / 0.75 } as const;
const PAD_LEFT = 12;
const PAD_Y = 9;
const MARK_GAP = 9;

/** Figma 95:2430 — "NextKin Free · 2 of 2 resumes · 5 AI credits left · Upgrade ›". */
export function PlanCard({ subscription, onUpgrade }: PlanCardProps) {
  const { colors, spacing, s } = useTheme();
  const styles = useStyles();
  const { usage } = subscription;
  const summary = `${usage.resumesUsed} of ${usage.resumesLimit} resumes · ${usage.aiCreditsLeft} AI credits left`;
  const plan = SUBSCRIPTION_PLAN_LABEL[subscription.plan];

  return (
    <Card radius="card" padding={0}>
      <Pressable
        {...a11yButton(`${plan}, ${summary}`, 'Opens the plans page')}
        feedback="subtle"
        // Wrapped, so the press event is never handed on as an argument.
        onPress={() => onUpgrade()}
        style={[
          styles.row,
          {
            paddingLeft: s(PAD_LEFT),
            paddingRight: spacing[4] - 1,
            paddingVertical: s(PAD_Y),
            gap: s(MARK_GAP),
          },
        ]}
      >
        <PlanMarkIcon width={s(MARK.w)} height={s(MARK.h)} />

        <View style={styles.copy}>
          <Text variant="label" numberOfLines={1}>
            {plan}
          </Text>
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {summary}
          </Text>
        </View>

        {subscription.plan === 'free' ? (
          <View style={[styles.upgrade, { gap: spacing[1] + 2 }]}>
            <Text variant="segmentActive">Upgrade</Text>
            <Icon name="ChevronRight" size="xs" color={colors.textPrimary} />
          </View>
        ) : null}
      </Pressable>
    </Card>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1, gap: s(1) },
  upgrade: { flexDirection: 'row', alignItems: 'center' },
}));
