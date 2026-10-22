/**
 * The `PaymentProvider` port (ImBackendImplementationPlan P12-06; spec §9.8, §13.4). Product code
 * talks to this and never to a gateway SDK. Checkout is hosted (PCI SAQ A): we hand the user to the
 * provider's page and learn the outcome only from a verified webhook, which is persisted before it
 * is processed (P12-07).
 *
 * Adapters: `fake` (local and tests; its checkout page completes and signs its own webhook),
 * `stripeMock` (the Stripe adapter pointed at stripe-mock, for request shapes) and `stripe` (test
 * mode, then live, at X-13). Razorpay stays a dormant name.
 */

export type Currency = 'USD' | 'EUR' | 'AUD';
export type PaidPlanId = 'pro_monthly' | 'pro_annual';

export interface CheckoutRequest {
  billingAccountId: string;
  userId: string;
  email: string;
  customerRef: string | null;
  planId: PaidPlanId;
  period: 'month' | 'year';
  amountMinor: number;
  currency: Currency;
  country: string;
  priceVersion: number;
  successUrl: string;
  cancelUrl: string;
}

/** What a verified webhook means, in our words. Every adapter maps its own events onto these. */
export type BillingEvent =
  | { type: 'checkout.completed'; billingAccountId: string; planId: PaidPlanId; customerRef: string; subscriptionRef: string; currentPeriodEnd: string; currency: Currency; country: string | null }
  | { type: 'subscription.updated'; subscriptionRef: string; status: 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled'; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; pausedUntil: string | null; planId: PaidPlanId | null }
  | { type: 'subscription.deleted'; subscriptionRef: string }
  | { type: 'invoice.paid'; subscriptionRef: string; paymentRef: string; amountMinor: number; taxMinor: number; currency: Currency; occurredAt: string; card: { brand: 'visa' | 'mastercard' | 'amex'; last4: string; expMonth: number; expYear: number } | null }
  | { type: 'invoice.payment_failed'; subscriptionRef: string }
  | { type: 'charge.refunded'; paymentRef: string }
  | { type: 'ignored'; providerType: string };

export interface VerifiedEvent {
  eventId: string;
  providerType: string;
  payload: unknown;
}

export interface PaymentProvider {
  readonly name: 'fake' | 'stripe';
  createCheckout(request: CheckoutRequest): Promise<{ url: string; sessionRef: string }>;
  /** Throws `WebhookSignatureError` unless the body is signed by the provider. */
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): Promise<VerifiedEvent>;
  /** Maps a stored, verified payload to our event. Pure, so a persisted event can be reprocessed. */
  interpret(payload: unknown): BillingEvent;
  setCancelAtPeriodEnd(subscriptionRef: string, cancel: boolean): Promise<void>;
  /** §13.6: no collection until the date; the subscription resumes on its own. */
  pause(subscriptionRef: string, until: Date): Promise<void>;
  resume(subscriptionRef: string): Promise<void>;
  /** Ends the subscription now (the 14-day withdrawal) and refunds the payment. */
  cancelNowAndRefund(subscriptionRef: string, paymentRef: string | null): Promise<void>;
  /** Switches the cycle; the gateway prorates (§13.4: no custom proration math). */
  changePlan(subscriptionRef: string, planId: PaidPlanId, amountMinor: number, currency: Currency, period: 'month' | 'year'): Promise<void>;
}

export class WebhookSignatureError extends Error {
  constructor(message = 'The webhook signature does not verify.') {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

export class PaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
