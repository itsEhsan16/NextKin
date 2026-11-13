import type { CardBrand, Plan } from '@nextkin/shared/models';

/**
 * How the Billing & plan board (Figma 470:3) reads the plans. The board's two feature lists made
 * promises V2 §13 doesn't ("Up to 5 resumes", "Unlimited resumes", "Unlimited document storage")
 * and priced Pro at $9.99. By the owner's call the spec wins (`toreview.md` §92): each line below
 * restates a row of the §13.3 gating table (`PLAN_FEATURES`), and the price is the plan's own.
 */

export type PlanLine = { label: string; included: boolean };

/** The Free card's list: three it has, three it doesn't, as the board draws it. */
export const FREE_LINES: readonly PlanLine[] = [
  { label: '3 resume generations a month', included: true },
  { label: 'Clean PDF downloads, no watermark', included: true },
  { label: 'ATS score and report on every resume', included: true },
  { label: 'DOCX export', included: false },
  { label: 'Full template library', included: false },
  { label: 'Priority generation queue', included: false },
];

/**
 * What Pro adds, in one sentence for the places that summarise it: the sidebar's Upgrade card and
 * the Upgrade page (redesign R7d, audit SY-03). It restates `PRO_LINES`: those places used to
 * promise "unlimited generations" and "unlimited cover letters", which the plan doesn't give.
 */
export const PRO_SUMMARY =
  '100 resume generations a month, DOCX export, the full template library and a priority queue.';

/** The Pro card's list, every line included. */
export const PRO_LINES: readonly PlanLine[] = [
  { label: '100 resume generations a month', included: true },
  { label: 'DOCX export', included: true },
  { label: 'Full template library', included: true },
  { label: '30 standalone ATS checks a month', included: true },
  { label: 'Unlimited saved jobs', included: true },
  { label: 'Priority generation queue', included: true },
];

/**
 * "₹1,499" in the mock; "$19", "€109", "A$29" from the backend's price book (P12-08). Cents only
 * when an amount has them.
 */
export const formatMoney = (amount: number, currency: Plan['price']['currency']): string =>
  new Intl.NumberFormat(
    currency === 'INR'
      ? 'en-IN'
      : currency === 'EUR'
        ? 'de-DE'
        : currency === 'AUD'
          ? 'en-AU'
          : 'en-US',
    {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    },
  ).format(amount);

/** "₹1,499" and "/ month": the price and its period, set apart on the card (470:449). */
export const planPrice = (plan: Plan): { amount: string; per: string } => ({
  amount: formatMoney(plan.price.amount, plan.price.currency),
  per: `/ ${plan.price.period}`,
});

const DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "Apr 1, 2024" (471:100). */
export const invoiceDate = (iso: string): string => DAY.format(new Date(`${iso}T00:00:00Z`));

/** "Visa" for the card line; the tile prints the brand in capitals. */
export const CARD_BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
};

/** "04/2027" (471:21). */
export const cardExpiry = (month: number, year: number): string =>
  `${String(month).padStart(2, '0')}/${year}`;
