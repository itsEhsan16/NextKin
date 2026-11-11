import type { Plan, Subscription } from '@nextkin/shared/models';
import { cn } from '@/lib/cn';
import { cardPad, cardSurface } from '@/ui/Card';
import { brandButton } from '@/ui/brandButton';
import { CloseIcon, TickIcon } from '@/ui/icons';
import { NavUpgradeIllustration } from '@/ui/illustrations';
import { Soon, soonControl } from '@/ui/Soon';

import { FREE_LINES, planPrice, PRO_LINES, type PlanLine } from '../billingLibrary';

/**
 * Upgrade to Pro waits for checkout (V2 §13). It used to link to `/upgrade`, a coming-soon page
 * whose only way on was back to this tab: a loop (audit ST-08). Until checkout exists it says so
 * where the user is pointing, and "View all plans" is gone because both plans are on this page.
 */
const upgradeButton = cn(brandButton, 'h-control-lg rounded-md px-8 text-body-m font-semibold');

function Lines({ lines, label }: { lines: readonly PlanLine[]; label: string }) {
  return (
    <ul aria-label={label} className="mt-4 flex flex-col gap-2">
      {lines.map(({ label: line, included }) => (
        <li
          key={line}
          className={cn(
            'flex items-center gap-2.5 text-body-m',
            included ? 'text-text-primary' : 'text-text-tertiary',
          )}
        >
          {included ? (
            <TickIcon aria-hidden className="size-4 shrink-0 text-text-primary" />
          ) : (
            <CloseIcon aria-hidden className="size-3.5 shrink-0 text-text-tertiary" />
          )}
          {line}
          {!included && <span className="sr-only">, not included</span>}
        </li>
      ))}
    </ul>
  );
}

export type PlanCardsProps = {
  subscription: Subscription;
  /** Pro monthly, for its price; the card waits for it. */
  pro: Plan | undefined;
};

/**
 * "Current plan" and "NextKin Pro" (470:388), side by side: what the account is on, and the Pro
 * plan on the lavender card the board marks "Most popular". Both Upgrade buttons and "View all
 * plans" open the plan page. The lists are V2 §13.3's, not the board's (`billingLibrary`).
 */
export function PlanCards({ subscription, pro }: PlanCardsProps) {
  const onPro = subscription.plan === 'pro';
  const price = pro ? planPrice(pro) : undefined;

  return (
    <div className="grid grid-cols-2 items-stretch gap-6">
      <section aria-label="Current plan" className={cn(cardSurface, cardPad, 'flex flex-col')}>
        <div className="flex flex-1 items-start gap-4">
          <NavUpgradeIllustration aria-hidden className="h-auto w-10 shrink-0" />
          <div className="min-w-0">
            <p className="text-body-s text-text-tertiary">Current plan</p>
            <h2 className="text-h2 font-medium text-text-primary">
              {onPro ? 'NextKin Pro' : 'Free plan'}
            </h2>
            <p className="text-body-s text-text-tertiary">
              {onPro ? 'Everything NextKin offers' : 'Great to get started'}
            </p>
            <Lines lines={onPro ? PRO_LINES : FREE_LINES} label="What your plan includes" />
          </div>
        </div>
        {!onPro && (
          <div className="mt-5 flex items-center gap-8">
            <Soon label="Upgrades open soon">
              <button type="button" aria-disabled="true" className={cn(upgradeButton, soonControl)}>
                Upgrade to Pro
              </button>
            </Soon>
          </div>
        )}
      </section>

      <section
        aria-label="NextKin Pro"
        className={cn(
          cardSurface,
          cardPad,
          'flex flex-col border-border-brand-strong bg-surface-brand',
        )}
      >
        <div className="flex flex-1 items-start gap-4">
          <NavUpgradeIllustration aria-hidden className="h-auto w-10 shrink-0" />
          <div className="min-w-0">
            <span className="inline-block rounded-full bg-surface-brand-strong px-2.5 py-0.5 text-caption-m font-semibold text-brand-700">
              Most popular
            </span>
            <h2 className="mt-0.5 text-h2 font-medium text-text-primary">NextKin Pro</h2>
            <p className="text-body-s text-text-tertiary">Unlock your full potential</p>
            <p className="mt-2 flex items-baseline gap-1.5 text-text-primary">
              <span className="text-display-l font-medium">{price?.amount ?? '—'}</span>
              <span className="text-body-m">{price?.per}</span>
            </p>
            <p className="text-body-s text-text-tertiary">Billed monthly</p>
            <Lines lines={PRO_LINES} label="What Pro includes" />
          </div>
        </div>
        <div className="mt-5 pl-14">
          {onPro ? (
            <p className="text-body-m font-semibold text-brand-700">Your plan</p>
          ) : (
            <Soon label="Upgrades open soon">
              <button type="button" aria-disabled="true" className={cn(upgradeButton, soonControl)}>
                Upgrade to Pro
              </button>
            </Soon>
          )}
        </div>
      </section>
    </div>
  );
}
