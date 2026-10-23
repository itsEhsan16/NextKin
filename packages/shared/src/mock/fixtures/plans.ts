import type { Plan } from '@/data/models';

/**
 * NextKin V2 spec §13.2 — the three purchasable SKUs behind the plan screen (plan phase 9F).
 * No artboard draws it, so the shape comes from `Plan` and the entitlements from `PLAN_FEATURES`
 * (§13.3); every blurb below is a restatement of a row in that table, never a new promise.
 *
 * Deliberate divergence, recorded so nobody "fixes" it: §13.2 prices the real product in
 * USD/EUR/AUD and defers India to §6.2. Every other fixture in this folder speaks rupees —
 * salaries in lakh, George in Bengaluru, a ₹24L minimum on his profile — so a dollar plan card
 * would be the one screen quoting a currency the rest of the mock never uses. These are round
 * Indian SaaS prices standing in for the deferred India band, not list price. When §6.2 lands,
 * replace the numbers here; nothing else in the mock reads them.
 *
 * The annual saving is arithmetic, not marketing: 1,499 × 12 = 17,988 a year against 7,999 is a
 * saving of 9,989, or 55.5%. The badge rounds *down* to 55 so the claim is never overstated.
 */
export const plansFixture: Plan[] = [
  {
    id: 'free',
    tier: 'free',
    name: 'Free',
    price: { amount: 0, currency: 'INR', period: 'month' },
    blurb: 'Three resume generations a month, with clean PDF export and no watermark.',
  },
  {
    id: 'pro_monthly',
    tier: 'pro',
    name: 'Pro monthly',
    price: { amount: 1499, currency: 'INR', period: 'month' },
    blurb: 'Higher caps, DOCX export and a priority generation queue. Cancel any time.',
  },
  {
    id: 'pro_annual',
    tier: 'pro',
    name: 'Pro annual',
    price: { amount: 7999, currency: 'INR', period: 'year' },
    badge: 'Save 55%',
    blurb: 'The same Pro, paid once a year instead of twelve times.',
  },
];
