import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import type { BillingEvent, CheckoutRequest, PaidPlanId, PaymentProvider, VerifiedEvent } from './types';
import { WebhookSignatureError } from './types';

/**
 * The fake gateway (P12-06; L3: local and test only). It behaves like a hosted checkout without
 * one: `createCheckout` returns a link to a local page (`/billing/fake-checkout/{token}`), and
 * completing it signs and delivers the same webhooks a gateway would. Every other change (cancel,
 * pause, resume, a new cycle, a refund) is likewise only a signed webhook, so the account changes
 * through the one verified path, exactly as it will with Stripe.
 *
 * The checkout token carries the request, signed, so the fake keeps no state of its own.
 */

export const FAKE_SIGNATURE_HEADER = 'x-fake-signature';

export interface FakeSession {
  billingAccountId: string;
  planId: PaidPlanId;
  period: 'month' | 'year';
  amountMinor: number;
  currency: CheckoutRequest['currency'];
  country: string;
  successUrl: string;
  cancelUrl: string;
}

export interface FakeProvider extends PaymentProvider {
  readonly name: 'fake';
  /** Reads a checkout token back, or null when it was not signed here. */
  readSession(token: string): FakeSession | null;
  /** "Pays" a session: delivers checkout.completed and the first invoice.paid. */
  completeCheckout(token: string): Promise<FakeSession>;
}

type Deliver = (rawBody: string, headers: Record<string, string>) => Promise<void>;

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString('utf8');

export function createFakeProvider(options: { secret: string; apiOrigin: string; deliver: () => Deliver }): FakeProvider {
  const sign = (body: string) => createHmac('sha256', options.secret).update(body).digest('hex');
  const send = async (event: BillingEvent) => {
    const body = JSON.stringify({ id: `evt_fake_${randomUUID()}`, type: event.type, data: event });
    await options.deliver()(body, { 'content-type': 'application/json', [FAKE_SIGNATURE_HEADER]: sign(body) });
  };
  const readSession = (token: string): FakeSession | null => {
    const [payload, mac] = token.split('.');
    if (!payload || !mac) return null;
    const expected = sign(payload);
    if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    return JSON.parse(unb64(payload)) as FakeSession;
  };

  return {
    name: 'fake',
    readSession,
    async createCheckout(request) {
      const session: FakeSession = { billingAccountId: request.billingAccountId, planId: request.planId, period: request.period, amountMinor: request.amountMinor, currency: request.currency, country: request.country, successUrl: request.successUrl, cancelUrl: request.cancelUrl };
      const payload = b64(JSON.stringify(session));
      const token = `${payload}.${sign(payload)}`;
      return { url: `${options.apiOrigin.replace(/\/$/, '')}/api/v1/billing/fake-checkout/${token}`, sessionRef: `cs_fake_${payload.slice(0, 16)}` };
    },
    async completeCheckout(token) {
      const session = readSession(token);
      if (!session) throw new WebhookSignatureError('That checkout link was not issued here.');
      const subscriptionRef = `sub_fake_${randomUUID()}`;
      const end = new Date();
      if (session.period === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1);
      else end.setUTCMonth(end.getUTCMonth() + 1);
      await send({ type: 'checkout.completed', billingAccountId: session.billingAccountId, planId: session.planId, customerRef: `cus_fake_${session.billingAccountId}`, subscriptionRef, currentPeriodEnd: end.toISOString(), currency: session.currency, country: session.country });
      // A tax-inclusive market's price already holds the tax; the fake books 19% VAT and 10% GST in it.
      const rate = session.currency === 'EUR' ? 0.19 : session.currency === 'AUD' ? 0.1 : 0;
      const taxMinor = Math.round(session.amountMinor - session.amountMinor / (1 + rate));
      await send({ type: 'invoice.paid', subscriptionRef, paymentRef: `pi_fake_${randomUUID()}`, amountMinor: session.amountMinor, taxMinor, currency: session.currency, occurredAt: new Date().toISOString(), card: { brand: 'visa', last4: '4242', expMonth: 12, expYear: new Date().getUTCFullYear() + 3 } });
      return session;
    },
    async verifyWebhook(rawBody, headers): Promise<VerifiedEvent> {
      const given = headers[FAKE_SIGNATURE_HEADER] ?? '';
      const expected = sign(rawBody);
      if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) throw new WebhookSignatureError();
      const parsed = JSON.parse(rawBody) as { id: string; type: string };
      return { eventId: parsed.id, providerType: parsed.type, payload: parsed };
    },
    interpret(payload) {
      return (payload as { data: BillingEvent }).data;
    },
    async setCancelAtPeriodEnd(subscriptionRef, cancel) {
      await send({ type: 'subscription.updated', subscriptionRef, status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: cancel, pausedUntil: null, planId: null });
    },
    async pause(subscriptionRef, until) {
      await send({ type: 'subscription.updated', subscriptionRef, status: 'paused', currentPeriodEnd: null, cancelAtPeriodEnd: false, pausedUntil: until.toISOString(), planId: null });
    },
    async resume(subscriptionRef) {
      await send({ type: 'subscription.updated', subscriptionRef, status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: false, pausedUntil: null, planId: null });
    },
    async cancelNowAndRefund(subscriptionRef, paymentRef) {
      if (paymentRef) await send({ type: 'charge.refunded', paymentRef });
      await send({ type: 'subscription.deleted', subscriptionRef });
    },
    async changePlan(subscriptionRef, planId) {
      await send({ type: 'subscription.updated', subscriptionRef, status: 'active', currentPeriodEnd: null, cancelAtPeriodEnd: false, pausedUntil: null, planId });
    },
  };
}
