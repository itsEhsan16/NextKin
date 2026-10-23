/**
 * The web Settings → Billing & plan board (Figma 470:3): the card on file, how the subscription
 * renews, and the invoices so far. Stripe Billing holds the card itself (V2 §13.4), so the app
 * keeps only what the board prints of it: the brand, the last four digits and the expiry.
 */

import type { BillingCurrency } from './plan';

export type CardBrand = 'visa' | 'mastercard' | 'amex';

export type PaymentMethod = {
  id: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  /** The card charged at renewal: the board's "Default" pill (471:22). */
  isDefault: boolean;
};

export type BillingCycle = 'monthly' | 'annual';

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
};

/** "Subscription settings" (471:28): what the account changes itself, saved as it changes. */
export type BillingSettings = {
  autoRenew: boolean;
  cycle: BillingCycle;
};

export type InvoiceStatus = 'paid' | 'open' | 'refunded';

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: 'Paid',
  open: 'Due',
  refunded: 'Refunded',
};

/** One row of "Billing history" (471:82). V2 §13.4 emails each one too. */
export type Invoice = {
  id: string;
  /** ISO-8601 date (YYYY-MM-DD) */
  issuedOn: string;
  description: string;
  /** Major units: INR in the mock, the account's currency from the backend (P12-08). */
  amount: { amount: number; currency: BillingCurrency };
  /** The tax the amount includes (VAT, GST), when the invoice shows it (§13.4). */
  tax?: number;
  /** The sequential invoice number (§13.4: German invoices need one). */
  number?: string;
  status: InvoiceStatus;
};

export type Billing = {
  paymentMethods: PaymentMethod[];
  settings: BillingSettings;
  /** Newest first. */
  invoices: Invoice[];
};
