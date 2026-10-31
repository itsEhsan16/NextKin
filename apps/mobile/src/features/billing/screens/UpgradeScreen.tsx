import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { PlanId } from '@/data/models';
import { track, usePlans, useSubscription, useUpgradePlan } from '@/data/queries';
import { haptics } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';

import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';
import { Toast } from '@/ui/Toast';
import { useRevealStagger } from '@/ui/motion';

import { CheckoutConfirm } from '../components/CheckoutConfirm';
import { PlanComparison } from '../components/PlanComparison';
import { PlanPeriodRow, type Period } from '../components/PlanPeriodRow';
import { PlanReasonBanner } from '../components/PlanReasonBanner';
import { PlanTiles } from '../components/PlanTiles';
import { PlanUsageCard } from '../components/PlanUsageCard';
import { ProStatusCard } from '../components/ProStatusCard';
import { UpgradeHero } from '../components/UpgradeHero';
import { UpgradeSkeleton } from '../components/UpgradeSkeleton';
import { useBillingActions } from '../hooks/useBillingActions';
import {
  annualSaving,
  annualSavingLine,
  BILLING_NOTE,
  HERO_CAPTION,
  LOADING_CTA,
  MANAGE_CTA,
  MANAGE_NOTE,
  MANAGE_UNAVAILABLE,
  PLANS_ERROR_MESSAGE,
  PLANS_ERROR_TITLE,
  PRO_HERO_CAPTION,
  REASON_METER,
  renewalLine,
  TRUST_LINE,
  upgradeCtaLabel,
  UPGRADED_TOAST,
} from '../upgradeCopy';
import type { UpgradeReason } from '../upgradeReasons';
/** How often, and how many times, the plan is read again while a hosted checkout completes. */
const CHECKOUT_POLL_MS = 3000;
const CHECKOUT_POLLS = 40;

export type UpgradeScreenProps = { reason?: UpgradeReason };

export const SCREEN_TITLE = 'NextKin Pro';
const PRO_SKU: Record<Period, PlanId> = { monthly: 'pro_monthly', annual: 'pro_annual' };

// BILLING 01 at 390 (577:9155), in artboard units: the board's spacers between its blocks.
const HEADER_TO_HERO = 8 / 0.75;
const GAP_SM = 10 / 0.75;
const GAP_MD = 12 / 0.75;
const GAP_LG = 18 / 0.75;

/**
 * The plan screen (V2 §13) — the single destination behind every paywall in the app — drawn as
 * BILLING 01 (577:9155), with BILLING 02's checkout confirm (580:314) over it.
 *
 * Three rules from §13 shape it. The reader arrives with the limit they hit, and the banner names
 * that limit rather than opening on a pitch (§13.5). The live meter sits above the offer, so the
 * caps are known before any argument for raising them (§13.5 again). And nothing here takes
 * money: the web is the purchase surface (§13.4/§15), which the bar says before the press and the
 * confirm says again after it.
 */
export function UpgradeScreen({ reason }: UpgradeScreenProps) {
  useEffect(() => track('paywall_seen', reason ? { reason } : undefined), [reason]);
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useBillingActions();

  const plans = usePlans();
  const subscription = useSubscription();
  const upgrade = useUpgradePlan();

  const [period, setPeriod] = useState<Period>('monthly');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [manageNote, setManageNote] = useState<string | undefined>(undefined);
  const [awaitingCheckout, setAwaitingCheckout] = useState(false);

  // After a hosted checkout: read the subscription again every few seconds, for up to two minutes,
  // until the webhook has made the plan Pro; then the same confirmation as an instant upgrade.
  const refetchSubscription = subscription.refetch;
  useEffect(() => {
    if (!awaitingCheckout) return undefined;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      void refetchSubscription().then((r) => {
        if (r.data?.plan === 'pro') {
          clearInterval(timer);
          setAwaitingCheckout(false);
          setPurchased(true);
          haptics.success();
        }
      });
      if (tries >= CHECKOUT_POLLS) {
        clearInterval(timer);
        setAwaitingCheckout(false);
      }
    }, CHECKOUT_POLL_MS);
    return () => clearInterval(timer);
  }, [awaitingCheckout, refetchSubscription]);

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
      onSuccess: (result) => {
        setConfirmOpen(false);
        if (result.kind === 'checkout') {
          // The backend's hosted checkout opens in the browser (D-18: nothing is sold in the app);
          // the plan changes when the gateway's webhook lands, so the meter is watched until then.
          void actions.openCheckout(result.url).then((opened) => {
            if (opened === 'unavailable') setManageNote(MANAGE_UNAVAILABLE);
            else setAwaitingCheckout(true);
          });
          return;
        }
        setPurchased(true);
        // Felt as well as read, alongside the toast (§85). Once: a mutate call's own callbacks
        // run for the call that landed, and the sheet is busy while it is in flight.
        haptics.success();
      },
    });
  }, [actions, pro, upgrade]);

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

  // Sections fade up in turn only when loaded data replaces the skeleton; a screen that opens
  // with its data already here slides in whole with the push.
  const enter = useRevealStagger(!plans.isPending && !subscription.isPending);

  // The board leaves the header's title slot blank: the hero names the page. A failed load has no
  // hero, so its header keeps the name.
  const page = (children: ReactNode, footer?: ReactNode, showTitle = false) => (
    <View style={styles.root}>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title={SCREEN_TITLE} showTitle={showTitle} onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
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
      <StickyActionBar floating primary={{ label: LOADING_CTA, disabled: true }} />,
    );
  }

  const failed = () =>
    page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title={PLANS_ERROR_TITLE}
        message={PLANS_ERROR_MESSAGE}
        actionLabel="Try again"
        onAction={() => {
          void plans.refetch();
          void subscription.refetch();
        }}
      />,
      undefined,
      true,
    );

  if (plans.isError || subscription.isError || !sub) return failed();

  // Already paying: the page stops selling and becomes a statement of where the reader stands.
  // There is no upgrade CTA to draw and no SKU to price, so the plan list is not consulted.
  if (sub.plan === 'pro') {
    return page(
      <>
        <UpgradeHero title={SCREEN_TITLE} caption={PRO_HERO_CAPTION} />
        <Animated.View entering={enter(0)} style={styles.gapMd}>
          <ProStatusCard renewal={renewalLine(sub.renewsAt)} />
        </Animated.View>
        <Animated.View entering={enter(1)} style={styles.gapMd}>
          <PlanUsageCard usage={sub.usage} plan={sub.plan} />
        </Animated.View>
        <Animated.View entering={enter(2)} style={styles.gapLg}>
          <PlanComparison />
        </Animated.View>
      </>,
      <StickyActionBar
        floating
        note={manageNote ?? MANAGE_NOTE}
        // The browser not opening is a failure, so it reads as one rather than as the hint (§85).
        noteTone={manageNote ? 'danger' : 'neutral'}
        primary={{ label: MANAGE_CTA, icon: 'LinkExternal01', onPress: manage }}
      />,
    );
  }

  // A plan list with no Free row or no Pro SKU cannot be priced, and a CTA that named no price
  // would be the unpublished cap §13.1 forbids. That is a failed load, not an empty state — the
  // comparison table itself is static and never empty.
  if (!free || !pro) return failed();

  return page(
    <>
      <UpgradeHero title={SCREEN_TITLE} caption={HERO_CAPTION} />

      {reason ? (
        <Animated.View entering={enter(0)} style={styles.gapMd}>
          <PlanReasonBanner reason={reason} />
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(1)} style={styles.gapMd}>
        <PlanUsageCard
          usage={sub.usage}
          plan={sub.plan}
          emphasis={reason ? REASON_METER[reason] : undefined}
        />
      </Animated.View>

      <Animated.View entering={enter(2)} style={styles.gapLg}>
        <PlanPeriodRow value={period} onChange={setPeriod} />
      </Animated.View>

      <Animated.View entering={enter(3)} style={styles.gapSm}>
        <PlanTiles
          free={free}
          pro={pro}
          current={sub.plan}
          savingLine={period === 'annual' && saving ? annualSavingLine(saving) : undefined}
        />
      </Animated.View>

      <Animated.View entering={enter(4)} style={styles.gapLg}>
        <PlanComparison />
      </Animated.View>

      <Text variant="micro" color="textSecondary" align="center" style={styles.gapMd}>
        {TRUST_LINE}
      </Text>
    </>,
    <StickyActionBar
      floating
      note={BILLING_NOTE}
      primary={{ label: upgradeCtaLabel(pro), onPress: () => setConfirmOpen(true) }}
    />,
  );
}

const useStyles = scaledSheet((s) => ({
  root: { flex: 1 },
  gapSm: { marginTop: s(GAP_SM) },
  gapMd: { marginTop: s(GAP_MD) },
  gapLg: { marginTop: s(GAP_LG) },
}));
