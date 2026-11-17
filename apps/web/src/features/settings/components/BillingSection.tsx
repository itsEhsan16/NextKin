import { queryPhase, useBilling, usePlans, useSubscription } from '@nextkin/shared/queries';

import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { BillingHistoryCard, PaymentMethodCard, SubscriptionSettingsCard } from './BillingCards';
import { PlanOverview } from './PlanOverview';
import { useReveal } from '@/lib/useReveal';
import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';

/**
 * Settings → Billing & plan, redrawn from the owner's reference (toreview §216): the current plan
 * full width with its usage, then the card on file beside how it renews, then the invoices. Loads
 * its own data, as the Notifications section does.
 */
export function BillingSection() {
  const subscription = useSubscription();
  const plans = usePlans();
  const billing = useBilling();
  // The section loads after its panel has faded in, so it fades its own cards in (§102).
  const reveal = useReveal(Boolean(subscription.data && billing.data));

  if ([subscription, billing].some((query) => queryPhase(query) === 'error')) {
    return (
      <section aria-label="Billing & plan" className={cn(cardSurface, 'py-12')}>
        <StateView
          tone="danger"
          title="Something went wrong"
          message="We couldn't load your billing details. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            void subscription.refetch();
            void billing.refetch();
          }}
        />
      </section>
    );
  }

  if (!subscription.data || !billing.data) {
    return (
      <>
        {/* The three rows at their loaded heights (`toreview.md` §84). */}
        <Skeleton className="h-100 rounded-lg" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-50 rounded-lg" />
          <Skeleton className="h-50 rounded-lg" />
        </div>
        <Skeleton className="h-60 rounded-lg" />
      </>
    );
  }

  // The SKU the account renews on; on Free, the one its chosen cycle would buy.
  const proPlanId =
    subscription.data.planId && subscription.data.planId !== 'free'
      ? subscription.data.planId
      : billing.data.settings.cycle === 'annual'
        ? 'pro_annual'
        : 'pro_monthly';

  return (
    <div className={cn('flex flex-col gap-6', reveal && 'animate-reveal')}>
      <PlanOverview
        subscription={subscription.data}
        plan={plans.data?.find((plan) => plan.id === proPlanId)}
        invoices={billing.data.invoices}
      />
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
        <PaymentMethodCard billing={billing.data} />
        <SubscriptionSettingsCard billing={billing.data} />
      </div>
      <BillingHistoryCard billing={billing.data} />
    </div>
  );
}
