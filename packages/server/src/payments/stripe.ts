import { createHmac, timingSafeEqual } from 'node:crypto';

import { guardedFetch } from '../net/egress';
import type { BillingEvent, Currency, PaidPlanId, PaymentProvider, VerifiedEvent } from './types';
import { PaymentProviderError, WebhookSignatureError } from './types';

/**
 * The Stripe adapter (P12-06; spec §9.8, §13.4), over Stripe's REST API through the egress guard:
 * no SDK, so nothing outside this file knows Stripe exists. The same code points at stripe-mock
 * (`PAYMENT_ADAPTER=stripeMock`, request shapes only) or at Stripe test mode and live (X-13).
 *
 * - Checkout is a hosted Checkout Session in subscription mode. Prices come from our versioned
 *   price book as `price_data`, so no Stripe price ids are managed by hand; Stripe Tax computes
 *   VAT and GST (`automatic_tax`), and the billing address is collected for it.
 * - Webhooks are verified with Stripe's scheme (`Stripe-Signature: t=…,v1=…`, HMAC-SHA256 of
 *   `t.body`) within a five-minute tolerance.
 */

const TOLERANCE_SECONDS = 300;
const PLAN_NAME: Record<PaidPlanId, string> = { pro_monthly: 'NextKin Pro (monthly)', pro_annual: 'NextKin Pro (annual)' };

type Params = Record<string, string | number | boolean | undefined>;

function form(params: Params): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);
const currencyOf = (c: unknown): Currency => (String(c).toUpperCase() as Currency);
const planOf = (meta: unknown): PaidPlanId | null => {
  const id = (meta as Record<string, string> | null)?.plan_id;
  return id === 'pro_monthly' || id === 'pro_annual' ? id : null;
};

export function createStripeProvider(options: { apiBase: string; secretKey: string; webhookSecret: string; fetch?: typeof fetch; now?: () => number }): PaymentProvider {
  const doFetch = options.fetch ?? guardedFetch;
  const now = options.now ?? (() => Date.now());

  async function call(method: 'GET' | 'POST' | 'DELETE', path: string, params: Params = {}): Promise<Record<string, unknown>> {
    const body = method === 'GET' ? undefined : form(params);
    const query = method === 'GET' && Object.keys(params).length ? `?${form(params)}` : '';
    const res = await doFetch(`${options.apiBase.replace(/\/$/, '')}${path}${query}`, {
      method,
      headers: { authorization: `Bearer ${options.secretKey}`, 'content-type': 'application/x-www-form-urlencoded', 'stripe-version': '2024-06-20' },
      ...(body !== undefined ? { body } : {}),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new PaymentProviderError(`Stripe ${method} ${path} answered ${res.status}: ${String((json.error as { message?: string } | undefined)?.message ?? '')}`.slice(0, 300));
    return json;
  }

  const priceData = (planId: PaidPlanId, amountMinor: number, currency: Currency, period: 'month' | 'year', prefix: string): Params => ({
    [`${prefix}[price_data][currency]`]: currency.toLowerCase(),
    [`${prefix}[price_data][unit_amount]`]: amountMinor,
    [`${prefix}[price_data][recurring][interval]`]: period,
    [`${prefix}[price_data][product_data][name]`]: PLAN_NAME[planId],
    // EUR and AUD prices include VAT and GST (§13.4); USD is before sales tax.
    [`${prefix}[price_data][tax_behavior]`]: currency === 'USD' ? 'exclusive' : 'inclusive',
  });

  return {
    name: 'stripe',
    async createCheckout(r) {
      const session = await call('POST', '/v1/checkout/sessions', {
        mode: 'subscription',
        ...(r.customerRef ? { customer: r.customerRef } : { customer_email: r.email }),
        client_reference_id: r.billingAccountId,
        'line_items[0][quantity]': 1,
        ...priceData(r.planId, r.amountMinor, r.currency, r.period, 'line_items[0]'),
        'metadata[billing_account_id]': r.billingAccountId,
        'metadata[plan_id]': r.planId,
        'metadata[price_version]': r.priceVersion,
        'subscription_data[metadata][billing_account_id]': r.billingAccountId,
        'subscription_data[metadata][plan_id]': r.planId,
        'automatic_tax[enabled]': true,
        billing_address_collection: 'required',
        success_url: r.successUrl,
        cancel_url: r.cancelUrl,
      });
      if (typeof session.url !== 'string' || typeof session.id !== 'string') throw new PaymentProviderError('Stripe returned a checkout session without a URL.');
      return { url: session.url, sessionRef: session.id };
    },
    async verifyWebhook(rawBody, headers): Promise<VerifiedEvent> {
      const header = headers['stripe-signature'] ?? '';
      const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
      const t = Number(parts.t);
      const v1 = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
      if (!t || !v1.length) throw new WebhookSignatureError();
      if (Math.abs(now() / 1000 - t) > TOLERANCE_SECONDS) throw new WebhookSignatureError('The webhook is outside the replay window.');
      const expected = createHmac('sha256', options.webhookSecret).update(`${t}.${rawBody}`).digest('hex');
      if (!v1.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)))) throw new WebhookSignatureError();
      const event = JSON.parse(rawBody) as { id: string; type: string };
      return { eventId: event.id, providerType: event.type, payload: event };
    },
    interpret(payload): BillingEvent {
      const event = payload as { type: string; data: { object: Record<string, unknown> } };
      const o = event.data?.object ?? {};
      switch (event.type) {
        case 'checkout.session.completed': {
          const plan = planOf(o.metadata);
          const account = (o.client_reference_id ?? (o.metadata as Record<string, string> | undefined)?.billing_account_id) as string | undefined;
          if (!plan || !account || typeof o.subscription !== 'string' || typeof o.customer !== 'string') return { type: 'ignored', providerType: event.type };
          const country = ((o.customer_details as { address?: { country?: string } } | undefined)?.address?.country ?? null) as string | null;
          return { type: 'checkout.completed', billingAccountId: account, planId: plan, customerRef: o.customer, subscriptionRef: o.subscription, currentPeriodEnd: iso(o.expires_at as number) ?? new Date().toISOString(), currency: currencyOf(o.currency), country };
        }
        case 'customer.subscription.updated': {
          const status = String(o.status);
          const paused = (o.pause_collection as { resumes_at?: number } | null)?.resumes_at ?? null;
          const mapped = paused ? 'paused' : status === 'active' || status === 'trialing' || status === 'past_due' ? status : 'canceled';
          return { type: 'subscription.updated', subscriptionRef: String(o.id), status: mapped, currentPeriodEnd: iso(o.current_period_end as number), cancelAtPeriodEnd: Boolean(o.cancel_at_period_end), pausedUntil: iso(paused), planId: planOf(o.metadata) };
        }
        case 'customer.subscription.deleted':
          return { type: 'subscription.deleted', subscriptionRef: String(o.id) };
        case 'invoice.paid':
          if (typeof o.subscription !== 'string') return { type: 'ignored', providerType: event.type };
          return { type: 'invoice.paid', subscriptionRef: o.subscription, paymentRef: String(o.payment_intent ?? o.charge ?? o.id), amountMinor: Number(o.amount_paid ?? 0), taxMinor: Number(o.tax ?? 0), currency: currencyOf(o.currency), occurredAt: iso(o.created as number) ?? new Date().toISOString(), card: null };
        case 'invoice.payment_failed':
          return typeof o.subscription === 'string' ? { type: 'invoice.payment_failed', subscriptionRef: o.subscription } : { type: 'ignored', providerType: event.type };
        case 'charge.refunded':
          return { type: 'charge.refunded', paymentRef: String(o.payment_intent ?? o.id) };
        default:
          return { type: 'ignored', providerType: event.type };
      }
    },
    async setCancelAtPeriodEnd(subscriptionRef, cancel) {
      await call('POST', `/v1/subscriptions/${subscriptionRef}`, { cancel_at_period_end: cancel });
    },
    async pause(subscriptionRef, until) {
      await call('POST', `/v1/subscriptions/${subscriptionRef}`, { 'pause_collection[behavior]': 'void', 'pause_collection[resumes_at]': Math.floor(until.getTime() / 1000) });
    },
    async resume(subscriptionRef) {
      await call('POST', `/v1/subscriptions/${subscriptionRef}`, { pause_collection: '' });
    },
    async cancelNowAndRefund(subscriptionRef, paymentRef) {
      await call('DELETE', `/v1/subscriptions/${subscriptionRef}`);
      if (paymentRef) await call('POST', '/v1/refunds', { payment_intent: paymentRef });
    },
    async changePlan(subscriptionRef, planId, amountMinor, currency, period) {
      const sub = await call('GET', `/v1/subscriptions/${subscriptionRef}`);
      const first = ((sub.items as { data?: { id: string; price?: { product?: string | { id: string } } }[] } | undefined)?.data ?? [])[0];
      const product = typeof first?.price?.product === 'string' ? first.price.product : first?.price?.product?.id;
      if (!first || !product) throw new PaymentProviderError('The subscription has no item to change.');
      // A subscription item's price_data names an existing product (Checkout's names product_data).
      const data = priceData(planId, amountMinor, currency, period, 'items[0]');
      delete data['items[0][price_data][product_data][name]'];
      await call('POST', `/v1/subscriptions/${subscriptionRef}`, { 'items[0][id]': first.id, ...data, 'items[0][price_data][product]': product, proration_behavior: 'create_prorations', 'metadata[plan_id]': planId });
    },
  };
}
