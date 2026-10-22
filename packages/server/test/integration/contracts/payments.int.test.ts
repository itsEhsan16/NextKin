import { createHmac } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../../../src/config';
import { setEgressAllowlist } from '../../../src/net/egress';
import { createStripeProvider } from '../../../src/payments/stripe';
import { WebhookSignatureError } from '../../../src/payments/types';

/**
 * PaymentProvider contract against stripe-mock (P12-06, L2): every request the Stripe adapter makes
 * is one Stripe's API accepts (stripe-mock validates parameters against Stripe's OpenAPI spec), and
 * the webhook verification follows Stripe's signing scheme. Needs the `pay` compose profile. Stripe
 * test mode reruns this at X-13.
 */
const config = loadConfig();
const SECRET = 'whsec_contract_test';
const stripe = createStripeProvider({ apiBase: config.STRIPE_MOCK_URL, secretKey: 'sk_test_contract', webhookSecret: SECRET });

beforeAll(() => setEgressAllowlist([new URL(config.STRIPE_MOCK_URL).hostname]));

describe('PaymentProvider contract: Stripe (stripe-mock)', () => {
  it('creates a hosted subscription checkout with price data and automatic tax', async () => {
    const session = await stripe.createCheckout({ billingAccountId: '01a1aaaa-0000-7000-8000-000000000001', userId: 'u', email: 'synthetic@example.test', customerRef: null, planId: 'pro_monthly', period: 'month', amountMinor: 1900, currency: 'EUR', country: 'DE', priceVersion: 1, successUrl: 'http://localhost:3000/upgrade?checkout=success', cancelUrl: 'http://localhost:3000/upgrade?checkout=cancelled' });
    expect(session.url).toMatch(/^https?:\/\//);
    expect(session.sessionRef).toBeTruthy();
  });

  it('changes a subscription: cancel at period end, pause, resume, a new cycle, and the withdrawal', async () => {
    await stripe.setCancelAtPeriodEnd('sub_123', true);
    await stripe.pause('sub_123', new Date(Date.now() + 30 * 86_400_000));
    await stripe.resume('sub_123');
    await stripe.changePlan('sub_123', 'pro_annual', 10900, 'EUR', 'year');
    await stripe.cancelNowAndRefund('sub_123', 'pi_123');
  });

  it('verifies Stripe-signed webhooks and refuses forged or stale ones', async () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } });
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
    const ok = await stripe.verifyWebhook(body, { 'stripe-signature': `t=${t},v1=${v1}` });
    expect(ok.eventId).toBe('evt_1');
    expect(stripe.interpret(ok.payload)).toEqual({ type: 'subscription.deleted', subscriptionRef: 'sub_1' });
    await expect(stripe.verifyWebhook(body, { 'stripe-signature': `t=${t},v1=${'0'.repeat(64)}` })).rejects.toBeInstanceOf(WebhookSignatureError);
    const old = t - 3600;
    const stale = createHmac('sha256', SECRET).update(`${old}.${body}`).digest('hex');
    await expect(stripe.verifyWebhook(body, { 'stripe-signature': `t=${old},v1=${stale}` })).rejects.toBeInstanceOf(WebhookSignatureError);
  });
});
