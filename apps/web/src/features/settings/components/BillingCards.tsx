import {
  BILLING_CYCLE_LABEL,
  INVOICE_STATUS_LABEL,
  type Billing,
  type BillingCycle,
} from '@nextkin/shared/models';
import { useUpdateBillingSettings } from '@nextkin/shared/queries';
import { useId } from 'react';

import { AccountCard } from '@/features/account/components/AccountCard';
import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';
import { iconButton } from '@/ui/iconButton';
import { ArrowRight, CreditCard02, Download01, Edit03, Receipt, Settings01 } from '@/ui/lineIcons';
import { SelectField } from '@/ui/SelectField';
import { Soon, soonControl } from '@/ui/Soon';
import { Switch } from '@/ui/Switch';
import { Tag } from '@/ui/Tag';

import { CARD_BRAND_LABEL, cardExpiry, formatMoney, invoiceDate } from '../billingLibrary';

const CYCLES: readonly BillingCycle[] = ['monthly', 'annual'];

/**
 * "Payment method" (owner's reference, toreview §216): the default card on file. Changing it is
 * Stripe's checkout (V2 §13.4), which has no client yet, so "Update" says "coming soon".
 */
export function PaymentMethodCard({ billing }: { billing: Billing }) {
  const card =
    billing.paymentMethods.find((method) => method.isDefault) ?? billing.paymentMethods[0];

  return (
    <AccountCard
      Icon={CreditCard02}
      tile
      title="Payment method"
      description="The card used for your subscription and renewals."
      action={
        card && (
          <Soon>
            <button
              type="button"
              aria-disabled="true"
              className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), soonControl)}
            >
              <Edit03 aria-hidden className="size-4" />
              Update
            </button>
          </Soon>
        )
      }
      className="h-full"
    >
      {card ? (
        <div className="mt-5 flex items-center gap-4 rounded-md border border-border-subtle px-4 py-3">
          <span
            aria-hidden
            className="flex h-8 w-12 shrink-0 items-center justify-center rounded-sm border border-border-subtle bg-surface-card text-caption-m font-extrabold italic text-text-brand"
          >
            {card.brand.toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body-m font-semibold text-text-primary">
              {CARD_BRAND_LABEL[card.brand]} ending in {card.last4}
            </span>
            <span className="block text-body-s text-text-tertiary">
              Expires {cardExpiry(card.expMonth, card.expYear)}
            </span>
          </span>
          {card.isDefault && (
            <Tag tone="success" className="shrink-0">
              Default
            </Tag>
          )}
        </div>
      ) : (
        <p className="mt-5 rounded-md bg-neutral-50 px-4 py-4 text-body-m text-text-tertiary">
          No card on file. You add one at checkout when you upgrade.
        </p>
      )}
    </AccountCard>
  );
}

/** "Subscription settings": auto-renewal and the billing cycle, each saved as it changes. */
export function SubscriptionSettingsCard({ billing }: { billing: Billing }) {
  const update = useUpdateBillingSettings();
  const renewLine = useId();
  const cycleLine = useId();
  const { autoRenew, cycle } = billing.settings;

  return (
    <AccountCard
      Icon={Settings01}
      tile
      title="Subscription settings"
      description="Control how your subscription renews and how you're billed."
      className="h-full"
    >
      <div className="mt-5 flex min-h-14 items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-body-m font-semibold text-text-primary">Auto-renewal</p>
          <p id={renewLine} className="text-body-s text-text-tertiary">
            Automatically renew your plan at the end of each billing cycle.
          </p>
        </div>
        <Switch
          label="Auto-renewal"
          describedBy={renewLine}
          checked={autoRenew}
          onChange={(on) => update.mutate({ autoRenew: on })}
        />
      </div>
      <div className="mt-2 flex min-h-14 items-center gap-4 border-t border-border-subtle pt-2">
        <div className="min-w-0 flex-1">
          <p className="text-body-m font-semibold text-text-primary">Billing cycle</p>
          <p id={cycleLine} className="text-body-s text-text-tertiary">
            Choose how often you want to be billed.
          </p>
        </div>
        <SelectField
          label="Billing cycle"
          describedBy={cycleLine}
          value={cycle}
          options={CYCLES}
          labelOf={(option) => BILLING_CYCLE_LABEL[option]}
          onChange={(next) => update.mutate({ cycle: next })}
          className="w-36"
        />
      </div>
    </AccountCard>
  );
}

const HEAD =
  'whitespace-nowrap px-5 py-2.5 text-left text-caption-m font-medium text-text-tertiary';
const CELL = 'whitespace-nowrap px-5 py-3.5 text-body-m text-text-primary';

/**
 * "Billing history": each invoice's number, date, what it was for, the amount and whether it's
 * paid. Stripe emails every invoice (V2 §13.4); nothing serves the PDF yet, so download and
 * "View all invoices" say "coming soon" (`toreview.md` §92).
 */
export function BillingHistoryCard({ billing }: { billing: Billing }) {
  return (
    <AccountCard
      Icon={Receipt}
      tile
      title="Billing history"
      description="View and download your past invoices."
      action={
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            className={cn(
              'flex shrink-0 items-center gap-2 self-center rounded-sm text-body-m font-semibold text-text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
              soonControl,
            )}
          >
            View all invoices
            <ArrowRight aria-hidden className="size-4" />
          </button>
        </Soon>
      }
    >
      {billing.invoices.length === 0 ? (
        <p className="mt-5 rounded-md bg-neutral-50 px-4 py-4 text-body-m text-text-tertiary">
          No invoices yet. Each one appears here, and in your email, after a payment.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-md border border-border-subtle">
          <table className="w-full min-w-[40rem] border-collapse">
            <thead className="border-b border-border-subtle bg-neutral-50">
              <tr>
                <th scope="col" className={HEAD}>
                  Invoice
                </th>
                <th scope="col" className={HEAD}>
                  Date
                </th>
                <th scope="col" className={HEAD}>
                  Description
                </th>
                <th scope="col" className={HEAD}>
                  Amount
                </th>
                <th scope="col" className={HEAD}>
                  Status
                </th>
                <th scope="col" className={cn(HEAD, 'text-right')}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {billing.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className={CELL}>
                    <span className="flex items-center gap-2 font-medium text-text-brand">
                      <Receipt aria-hidden className="size-4 shrink-0 text-text-tertiary" />
                      <span className="truncate">{invoice.number ?? invoice.id}</span>
                    </span>
                  </td>
                  <td className={CELL}>{invoiceDate(invoice.issuedOn)}</td>
                  {/* Takes the room left over and truncates in it (`max-w-0`). */}
                  <td className={cn(CELL, 'w-full max-w-0 truncate')}>{invoice.description}</td>
                  <td className={CELL}>
                    {formatMoney(invoice.amount.amount, invoice.amount.currency)}
                  </td>
                  <td className={CELL}>
                    <Tag
                      tone={invoice.status === 'paid' ? 'success' : 'neutral'}
                      shape="pill"
                      className="gap-1.5"
                    >
                      <span aria-hidden className="size-2 rounded-full bg-current" />
                      {INVOICE_STATUS_LABEL[invoice.status]}
                    </Tag>
                  </td>
                  <td className={cn(CELL, 'text-right')}>
                    <Soon>
                      <button
                        aria-disabled="true"
                        type="button"
                        aria-label={`Download the ${invoiceDate(invoice.issuedOn)} invoice`}
                        className={cn(
                          soonControl,
                          iconButton,
                          'ml-auto border border-border-subtle text-text-brand',
                        )}
                      >
                        <Download01 aria-hidden className="size-4" />
                      </button>
                    </Soon>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountCard>
  );
}
