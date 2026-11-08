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
import { iconButton } from '@/ui/iconButton';
import { ArrowRightIcon, DownloadIcon, MoreVerticalIcon, PlusIcon } from '@/ui/icons';
import {
  NavSettingsIllustration,
  ProfileTermsIllustration,
  SettingsBillingIllustration,
} from '@/ui/illustrations';
import { SelectField } from '@/ui/SelectField';
import { Switch } from '@/ui/Switch';
import { Tag } from '@/ui/Tag';

import { CARD_BRAND_LABEL, cardExpiry, formatMoney, invoiceDate } from '../billingLibrary';
import { pressable } from '@/ui/pressable';
import { Soon, soonControl } from '@/ui/Soon';

const CYCLES: readonly BillingCycle[] = ['monthly', 'annual'];

/**
 * "Billing information" (471:3): the cards on file, the default one marked, and a dashed "Add
 * payment method". Adding a card is Stripe's checkout (V2 §13.4), which has no design or client
 * yet, so it and each card's menu are inert (`toreview.md` §92).
 */
export function BillingInfoCard({ billing }: { billing: Billing }) {
  return (
    <AccountCard
      Art={SettingsBillingIllustration}
      title="Billing information"
      description="Manage your payment methods and billing details."
    >
      <ul aria-label="Payment methods" className="mt-5 flex flex-col gap-2">
        {billing.paymentMethods.map((card) => (
          <li key={card.id} className="flex items-center gap-3 rounded-md bg-neutral-50 px-4 py-3">
            <span
              aria-hidden
              className="flex h-7.5 w-11 shrink-0 items-center justify-center rounded-sm border border-border-subtle bg-surface-card text-caption-m font-extrabold italic text-text-primary"
            >
              {card.brand.toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body-m text-text-primary">
                {CARD_BRAND_LABEL[card.brand]} <span aria-hidden>••••</span>
                <span className="sr-only">ending</span> {card.last4}
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
            <Soon>
              <button
                aria-disabled="true"
                type="button"
                aria-label={`Options for ${CARD_BRAND_LABEL[card.brand]} ending ${card.last4}`}
                className={cn(soonControl, iconButton, '-mr-1 text-text-secondary')}
              >
                <MoreVerticalIcon aria-hidden className="size-4" />
              </button>
            </Soon>
          </li>
        ))}
        <li>
          <Soon>
            <button
              aria-disabled="true"
              type="button"
              className={cn(
                soonControl,
                pressable,
                'flex h-control-lg w-full items-center gap-2.5 rounded-md border border-dashed border-border-brand-strong px-4 text-body-m text-brand-600 hover:bg-surface-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              )}
            >
              <PlusIcon aria-hidden className="size-4" />
              Add payment method
            </button>
          </Soon>
        </li>
      </ul>
    </AccountCard>
  );
}

/** "Subscription settings" (471:28): auto-renewal and the billing cycle, each saved as it changes. */
export function SubscriptionSettingsCard({ billing }: { billing: Billing }) {
  const update = useUpdateBillingSettings();
  const renewLine = useId();
  const cycleLine = useId();
  const { autoRenew, cycle } = billing.settings;

  return (
    <AccountCard
      Art={NavSettingsIllustration}
      title="Subscription settings"
      description="Manage how your subscription renews."
    >
      <div className="mt-5 flex min-h-14 items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-body-m text-text-primary">Auto-renewal</p>
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
          <p className="text-body-m text-text-primary">Billing cycle</p>
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
          className="w-32"
        />
      </div>
    </AccountCard>
  );
}

const HEAD = 'px-6 py-2.5 text-left text-caption-m font-medium text-text-tertiary';
const CELL = 'px-6 py-3.5 text-body-m text-text-primary';

/**
 * "Billing history" (471:56): each invoice's date, what it was for, the amount and whether it's
 * paid, and its PDF. Stripe emails every invoice (V2 §13.4); nothing serves the PDF yet, so the
 * download buttons and "View all invoices" are inert (`toreview.md` §92).
 */
export function BillingHistoryCard({ billing }: { billing: Billing }) {
  return (
    <AccountCard
      Art={ProfileTermsIllustration}
      title="Billing history"
      description="View and download your past invoices."
      action={
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            className={cn(
              'flex shrink-0 items-center gap-2 self-center rounded-sm text-body-m text-brand-600 transition-colors duration-press ease-standard hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              soonControl,
            )}
          >
            View all invoices
            <ArrowRightIcon aria-hidden className="size-4" />
          </button>
        </Soon>
      }
    >
      {billing.invoices.length === 0 ? (
        <p className="mt-5 rounded-md bg-neutral-50 px-4 py-4 text-body-m text-text-tertiary">
          No invoices yet. Each one appears here, and in your email, after a payment.
        </p>
      ) : (
        <div className="-mx-6 -mb-6 mt-5 overflow-hidden rounded-b-lg border-t border-border-subtle">
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[32%]" />
              <col className="w-[17%]" />
              <col className="w-[21%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="border-b border-border-subtle bg-neutral-50">
              <tr>
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
                <th scope="col" className={cn(HEAD, 'text-center')}>
                  Invoice
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {billing.invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className={CELL}>{invoiceDate(invoice.issuedOn)}</td>
                  <td className={cn(CELL, 'truncate')}>{invoice.description}</td>
                  <td className={CELL}>
                    {formatMoney(invoice.amount.amount, invoice.amount.currency)}
                  </td>
                  <td className={CELL}>
                    <Tag
                      tone={invoice.status === 'paid' ? 'success' : 'neutral'}
                      className="gap-1.5"
                    >
                      <span aria-hidden className="size-2 rounded-full bg-current" />
                      {INVOICE_STATUS_LABEL[invoice.status]}
                    </Tag>
                  </td>
                  <td className={cn(CELL, 'text-center')}>
                    <Soon>
                      <button
                        aria-disabled="true"
                        type="button"
                        aria-label={`Download the ${invoiceDate(invoice.issuedOn)} invoice`}
                        className={cn(soonControl, iconButton, 'mx-auto text-brand-600')}
                      >
                        <DownloadIcon aria-hidden className="size-4" />
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
