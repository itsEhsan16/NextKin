import { queryPhase, useBilling, usePlans, useSubscription } from '@nextkin/shared/queries';

import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { BillingHistoryCard, BillingInfoCard, SubscriptionSettingsCard } from './BillingCards';
import { PlanCards } from './PlanCards';
import { useReveal } from '@/lib/useReveal';
import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';

/**
 * Settings → Billing & plan (470:3), which replaced its coming-soon panel: the current plan beside
 * Pro, then the card on file beside how it renews, then the invoices. Loads its own data, as the
 * Notifications section does.
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
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-75 rounded-lg" />
          <Skeleton className="h-75 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-50 rounded-lg" />
          <Skeleton className="h-50 rounded-lg" />
        </div>
        <Skeleton className="h-48 rounded-lg" />
      </>
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', reveal && 'animate-reveal')}>
      <PlanCards
        subscription={subscription.data}
        pro={plans.data?.find((plan) => plan.id === 'pro_monthly')}
      />
      <div className="grid grid-cols-2 items-start gap-6">
        <BillingInfoCard billing={billing.data} />
        <SubscriptionSettingsCard billing={billing.data} />
      </div>
      <BillingHistoryCard billing={billing.data} />
    </div>
  );
}
