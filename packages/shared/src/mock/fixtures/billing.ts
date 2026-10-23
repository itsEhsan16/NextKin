import type { Billing } from '../../models';

/**
 * The Billing & plan board's account (Figma 470:3): a Visa ending 4242 as the default card,
 * renewing monthly, and two Pro invoices. The board prints them at $9.99; by the owner's call the
 * spec's prices win (`toreview.md` §92), so they are the Pro monthly price the plans quote,
 * ₹1,499 (`plansFixture`). George is on Free now, so these are from a Pro month he has since left.
 */
export const billingFixture: Billing = {
  paymentMethods: [
    {
      id: 'pm_visa_4242',
      brand: 'visa',
      last4: '4242',
      expMonth: 4,
      expYear: 2027,
      isDefault: true,
    },
  ],
  settings: { autoRenew: true, cycle: 'monthly' },
  invoices: [
    {
      id: 'inv_2024_04',
      issuedOn: '2024-04-01',
      description: 'NextKin Pro (Monthly)',
      amount: { amount: 1499, currency: 'INR' },
      status: 'paid',
    },
    {
      id: 'inv_2024_03',
      issuedOn: '2024-03-01',
      description: 'NextKin Pro (Monthly)',
      amount: { amount: 1499, currency: 'INR' },
      status: 'paid',
    },
  ],
};
