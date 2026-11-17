import type { Invoice, Plan, Subscription } from '@nextkin/shared/models';
import { useCancelSubscription, useResumeSubscription } from '@nextkin/shared/queries';
import { useState, type ComponentType, type SVGProps } from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { buttonClass } from '@/ui/Button';
import { cardPad, cardSurface } from '@/ui/Card';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import {
  Calendar,
  Check,
  CreditCard02,
  Crown,
  InfoCircle,
  Minus,
  SwitchHorizontal01,
  XClose,
} from '@/ui/lineIcons';
import { ProgressBar } from '@/ui/ProgressBar';
import { Soon, soonControl } from '@/ui/Soon';
import { Tag } from '@/ui/Tag';

import { daysUntil, FREE_LINES, formatMoney, invoiceDate, PRO_LINES } from '../billingLibrary';

/** "Feb 14, 2025" from an ISO timestamp or date. */
const longDate = (iso: string) => invoiceDate(iso.slice(0, 10));

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

/** One of the facts across the top of the plan: an icon, a label, the value and a quiet note. */
function Fact({
  Icon,
  label,
  value,
  note,
}: {
  Icon: Glyph;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-text-tertiary" />
      <div className="min-w-0">
        <p className="text-body-s text-text-tertiary">{label}</p>
        <p className="text-body-l font-semibold text-text-primary">
          {value}
          {note && (
            <span className="ml-1.5 inline-block whitespace-nowrap text-body-s font-normal text-text-tertiary">
              {note}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body-m font-medium text-text-primary">{label}</span>
        <span className="text-body-m text-text-tertiary">
          <span className="font-semibold text-text-primary">{used}</span> / {limit}
        </span>
      </div>
      <ProgressBar
        value={limit > 0 ? Math.min(1, used / limit) : 0}
        label={`${label}: ${used} of ${limit} used`}
        sweep
      />
    </div>
  );
}

export type PlanOverviewProps = {
  subscription: Subscription;
  /** The Pro SKU the account renews on (or would buy), for its price; the price waits for it. */
  plan: Plan | undefined;
  /** Newest first, as the billing query returns them. */
  invoices: readonly Invoice[];
};

/**
 * The current plan, full width (owner's reference, toreview §216): what it is and costs, when it
 * renews, what it includes, this month's usage against its limits, and what can be done about it.
 * Changing plan waits for checkout (V2 §13), so it says "coming soon"; cancelling and resuming
 * are the subscriber's own changes (P12-10) and work. There is no "View full plan details": the
 * only page it could open is `/upgrade`, still coming soon, and linking it recreates audit ST-08.
 */
export function PlanOverview({ subscription, plan, invoices }: PlanOverviewProps) {
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const [asking, setAsking] = useState(false);

  const onPro = subscription.plan === 'pro';
  const paused = Boolean(subscription.pausedUntil);
  const ending = Boolean(subscription.cancelAtPeriodEnd);
  const { usage, renewsAt } = subscription;
  const yearly = plan?.price.period === 'year';
  const price = plan ? formatMoney(plan.price.amount, plan.price.currency) : undefined;
  // The oldest paid invoice: the list is newest first.
  const started = onPro
    ? [...invoices].reverse().find((invoice) => invoice.status === 'paid')?.issuedOn
    : undefined;

  const status = paused ? (
    <Tag tone="neutral" shape="pill">
      Paused until {longDate(subscription.pausedUntil!)}
    </Tag>
  ) : onPro && ending && renewsAt ? (
    <Tag tone="warning" shape="pill">
      Ends {longDate(renewsAt)}
    </Tag>
  ) : onPro ? (
    <Tag tone="success" shape="pill" className="gap-1.5">
      <span aria-hidden className="size-2 rounded-full bg-current" />
      Active
    </Tag>
  ) : (
    <Tag tone="neutral" shape="pill">
      Free
    </Tag>
  );

  const days = renewsAt ? daysUntil(renewsAt) : undefined;
  const facts = onPro && (
    <div className="grid gap-4 border-b border-border-subtle pb-5 md:grid-cols-3 md:divide-x md:divide-border-subtle md:[&>*:not(:first-child)]:pl-5">
      {renewsAt && (
        <Fact
          Icon={Calendar}
          label={ending ? 'Access ends' : paused ? 'Resumes on' : 'Next billing date'}
          value={longDate(paused ? subscription.pausedUntil! : renewsAt)}
          note={
            !paused && days !== undefined
              ? `(in ${days} ${days === 1 ? 'day' : 'days'})`
              : undefined
          }
        />
      )}
      {price && !ending && (
        <Fact
          Icon={CreditCard02}
          label="Renewal amount"
          value={price}
          note="(+ applicable taxes)"
        />
      )}
      {started && (
        <Fact Icon={Calendar} label="Subscription started" value={invoiceDate(started)} />
      )}
    </div>
  );

  return (
    <section aria-label="Current plan" className={cn(cardSurface, cardPad, 'flex flex-col gap-6')}>
      <div className="flex flex-wrap items-start gap-4">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-text-brand"
        >
          <Crown className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-h2 font-semibold text-text-primary">
              {onPro ? 'NextKin Pro' : 'Free plan'}
            </h2>
            {status}
          </div>
          <p className="mt-0.5 text-body-m text-text-tertiary">Your current subscription</p>
        </div>
        <div className="text-right">
          {onPro ? (
            <>
              <p className="text-text-primary">
                <span className="text-display-l font-semibold">{price ?? '—'}</span>
                <span className="ml-1 text-body-l text-text-secondary">
                  / {yearly ? 'year' : 'month'}
                </span>
              </p>
              <p className="text-body-m text-text-tertiary">
                Billed {yearly ? 'yearly' : 'monthly'}
              </p>
            </>
          ) : (
            // The pill already says "Free"; the price says what it costs, in the account's money.
            <>
              <p className="text-text-primary">
                <span className="text-display-l font-semibold">
                  {plan ? formatMoney(0, plan.price.currency) : '—'}
                </span>
                <span className="ml-1 text-body-l text-text-secondary">/ month</span>
              </p>
              <p className="text-body-m text-text-tertiary">Nothing to pay</p>
            </>
          )}
        </div>
      </div>

      {facts}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <h3 className="text-title-l font-semibold text-text-primary">Your plan includes</h3>
            <ul
              aria-label="What your plan includes"
              className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2"
            >
              {(onPro ? PRO_LINES : FREE_LINES).map(({ label, included }) => (
                <li
                  key={label}
                  className={cn(
                    'flex items-center gap-2.5 text-body-m',
                    included ? 'text-text-primary' : 'text-text-tertiary',
                  )}
                >
                  {included ? (
                    <Check aria-hidden className="size-4 shrink-0 text-text-brand" />
                  ) : (
                    <Minus aria-hidden className="size-4 shrink-0 text-text-tertiary" />
                  )}
                  {label}
                  {!included && <span className="sr-only">, not included</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <section
          aria-label="This month’s usage"
          className="flex flex-col gap-5 rounded-lg bg-neutral-50 p-5"
        >
          <h3 className="flex items-center gap-2 text-title-l font-semibold text-text-primary">
            This month’s usage
            <span
              title="Counted since your plan's limits last reset."
              className="text-text-tertiary"
            >
              <InfoCircle aria-hidden className="size-4" />
            </span>
          </h3>
          <Meter
            label="Resume generations"
            used={usage.generationsUsed}
            limit={usage.generationsLimit}
          />
          {usage.atsChecksLimit !== undefined && (
            <Meter
              label="ATS checks"
              used={usage.atsChecksUsed ?? 0}
              limit={usage.atsChecksLimit}
            />
          )}
          <p className="mt-auto text-body-s text-text-tertiary">
            {renewsAt ? `Resets on ${longDate(renewsAt)}` : 'Resets each month'}
          </p>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Soon label={onPro ? 'Plan changes open soon' : 'Upgrades open soon'}>
          <button
            type="button"
            aria-disabled="true"
            className={cn(
              buttonClass({ variant: onPro ? 'primary' : 'paid', size: 'lg' }),
              soonControl,
            )}
          >
            <SwitchHorizontal01 aria-hidden className="size-5" />
            {onPro ? 'Change plan' : 'Upgrade to Pro'}
          </button>
        </Soon>
        {onPro && !ending && !paused && (
          <Button
            variant="secondary"
            size="lg"
            icon={<XClose aria-hidden className="size-5" />}
            onClick={() => setAsking(true)}
          >
            Cancel subscription
          </Button>
        )}
        {onPro && (ending || paused) && (
          <Button
            variant="brand-secondary"
            size="lg"
            loading={resume.isPending}
            busyLabel="Saving…"
            onClick={() => resume.mutate()}
          >
            {paused ? 'Resume subscription' : 'Keep my subscription'}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={asking}
        title="Cancel your subscription?"
        message={
          renewsAt
            ? `You keep Pro until ${longDate(renewsAt)}, then move to the Free plan. Nothing more is charged.`
            : 'You move to the Free plan at the end of this billing period. Nothing more is charged.'
        }
        confirmLabel="Cancel subscription"
        cancelLabel="Keep Pro"
        // Reversible until the period ends ("Keep my subscription"), so no red bin.
        tone="brand"
        busyLabel="Cancelling…"
        busy={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined, { onSettled: () => setAsking(false) })}
        onCancel={() => setAsking(false)}
      />
    </section>
  );
}
