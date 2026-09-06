import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { PlanId } from '@/data/models';
import { usePlans, useSubscription, useUpgradePlan } from '@/data/queries';
import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { SegmentedControl, type Segment } from '@/ui/SegmentedControl';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';
import { Toast } from '@/ui/Toast';

import { CheckoutConfirm } from '../components/CheckoutConfirm';
import { PlanComparison } from '../components/PlanComparison';
import { PlanReasonBanner } from '../components/PlanReasonBanner';
import { PlanTiles } from '../components/PlanTiles';
import { PlanUsageCard } from '../components/PlanUsageCard';
import { ProStatusCard } from '../components/ProStatusCard';
import { UpgradeSkeleton } from '../components/UpgradeSkeleton';
import { useBillingActions } from '../hooks/useBillingActions';
import {
  annualSaving,
  annualSavingLine,
  BILLING_NOTE,
  LOADING_CTA,
  MANAGE_CTA,
  MANAGE_NOTE,
  MANAGE_UNAVAILABLE,
  PLANS_ERROR_MESSAGE,
  PLANS_ERROR_TITLE,
  REASON_METER,
  renewalLine,
  TRUST_LINE,
  upgradeCtaLabel,
  UPGRADED_TOAST,
} from '../upgradeCopy';
import type { UpgradeReason } from '../upgradeReasons';

export type UpgradeScreenProps = { reason?: UpgradeReason };

export const SCREEN_TITLE = 'NextKin Pro';
export const BILLING_PERIOD_LABEL = 'Billing period';

type Period = 'monthly' | 'annual';

const PERIOD_SEGMENTS: readonly Segment<Period>[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'annual', label: 'Annual' },
];

const PRO_SKU: Record<Period, PlanId> = { monthly: 'pro_monthly', annual: 'pro_annual' };

/**
 * The plan screen (V2 §13) — the single destination behind every paywall in the app.
 * No artboard draws it (plan §8), so it is assembled from the built primitives alone.
 *
 * Three rules from §13 shape it. The reader arrives with the limit they hit, and the banner names
 * that limit rather than opening on a pitch (§13.5). The live meter sits above the offer, so the
 * caps are known before any argument for raising them (§13.5 again). And nothing here takes
 * money: the web is the purchase surface (§13.4/§15), which the bar says before the press and the
 * confirm says again after it.
 */
export function UpgradeScreen({ reason }: UpgradeScreenProps) {
  const { motion, spacing } = useTheme();
  const reduced = useReducedMotion();
  const actions = useBillingActions();

  const plans = usePlans();
  const subscription = useSubscription();
  const upgrade = useUpgradePlan();

  const [period, setPeriod] = useState<Period>('monthly');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [manageNote, setManageNote] = useState<string | undefined>(undefined);

  const list = plans.data ?? [];
  const free = list.find((plan) => plan.id === 'free');
  const monthly = list.find((plan) => plan.id === 'pro_monthly');
  const annual = list.find((plan) => plan.id === 'pro_annual');
  const pro = list.find((plan) => plan.id === PRO_SKU[period]);
  const saving = annualSaving(monthly, annual);
  const sub = subscription.data;

  const confirm = useCallback(() => {
    if (!pro) return;
    upgrade.mutate(pro.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        setPurchased(true);
      },
    });
  }, [pro, upgrade]);

  /**
   * The toast leaves before the page does. Popping on the same tick would unmount the
   * confirmation with the screen that owns it, so the reader would be returned to the gated
   * control with no word that anything happened.
   */
  const onToastHidden = useCallback(() => {
    setPurchased(false);
    actions.goBack();
  }, [actions]);

  const manage = useCallback(() => {
    void actions
      .manageOnWeb()
      .then((result) => setManageNote(result === 'unavailable' ? MANAGE_UNAVAILABLE : undefined));
  }, [actions]);

  const enter = (index: number) =>
    reduced
      ? undefined
      : FadeInDown.delay(index * motion.stagger.card).duration(motion.durations.base);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title={SCREEN_TITLE} onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: spacing[4] }}
        contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[5] }}
        footer={footer}
      >
        {children}
      </Screen>

      {/* Siblings of the page, never children of its scroller: the sheet's root is an absolute
          fill, and inside the scroll content box it would scrim the content, not the window. */}
      <CheckoutConfirm
        open={confirmOpen}
        busy={upgrade.isPending}
        failed={upgrade.isError}
        onConfirm={confirm}
        onCancel={() => setConfirmOpen(false)}
      />
      <Toast visible={purchased} message={UPGRADED_TOAST} onHide={onToastHidden} />
    </View>
  );

  // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
  // without one would grow a footer out of nothing the moment the queries land.
  if (plans.isPending || subscription.isPending) {
    return page(
      <UpgradeSkeleton />,
      <StickyActionBar primary={{ label: LOADING_CTA, disabled: true }} />,
    );
  }

  const failed = () =>
    page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title={PLANS_ERROR_TITLE}
        message={PLANS_ERROR_MESSAGE}
        actionLabel="Try again"
        onAction={() => {
          void plans.refetch();
          void subscription.refetch();
        }}
      />,
    );

  if (plans.isError || subscription.isError || !sub) return failed();

  // Already paying: the page stops selling and becomes a statement of where the reader stands.
  // There is no upgrade CTA to draw and no SKU to price, so the plan list is not consulted.
  if (sub.plan === 'pro') {
    return page(
      <>
        <Animated.View entering={enter(0)}>
          <ProStatusCard renewal={renewalLine(sub.renewsAt)} />
        </Animated.View>
        <Animated.View entering={enter(1)}>
          <PlanUsageCard usage={sub.usage} />
        </Animated.View>
        <Animated.View entering={enter(2)}>
          <PlanComparison />
        </Animated.View>
      </>,
      <StickyActionBar
        note={manageNote ?? MANAGE_NOTE}
        primary={{ label: MANAGE_CTA, icon: 'external-link-alt', onPress: manage }}
      />,
    );
  }

  // A plan list with no Free row or no Pro SKU cannot be priced, and a CTA that named no price
  // would be the unpublished cap §13.1 forbids. That is a failed load, not an empty state — the
  // comparison table itself is static and never empty.
  if (!free || !pro) return failed();

  return page(
    <>
      {reason ? (
        <Animated.View entering={enter(0)}>
          <PlanReasonBanner reason={reason} />
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(1)}>
        <PlanUsageCard usage={sub.usage} emphasis={reason ? REASON_METER[reason] : undefined} />
      </Animated.View>

      <Animated.View entering={enter(2)} style={{ gap: spacing[3] }}>
        <Text variant="groupLabel">{BILLING_PERIOD_LABEL}</Text>
        <SegmentedControl segments={PERIOD_SEGMENTS} value={period} onChange={setPeriod} />
      </Animated.View>

      <Animated.View entering={enter(3)}>
        <PlanTiles
          free={free}
          pro={pro}
          current={sub.plan}
          savingLine={period === 'annual' && saving ? annualSavingLine(saving) : undefined}
        />
      </Animated.View>

      <Animated.View entering={enter(4)}>
        <PlanComparison />
      </Animated.View>

      <Text variant="caption" color="textSecondary" align="center">
        {TRUST_LINE}
      </Text>
    </>,
    <StickyActionBar
      note={BILLING_NOTE}
      primary={{ label: upgradeCtaLabel(pro), onPress: () => setConfirmOpen(true) }}
    />,
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
