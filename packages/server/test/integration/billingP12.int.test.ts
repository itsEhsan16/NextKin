import { createHmac } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FAKE_SIGNATURE_HEADER } from '../../src/payments/fake';
import type { PaymentProvider } from '../../src/payments/types';
import { getSubscription } from '../../src/services/billing';
import { processPendingWebhooks } from '../../src/services/billingWebhooks';
import { log } from './fixtures/pipeline';
import { mobileLogin, registered, startHarness, type Harness } from './fixtures/authHarness';

/**
 * Billing against Postgres through the API (ImBackendImplementationPlan P12-06…P12-10): a hosted
 * checkout on the fake gateway, its signed webhooks persisted then processed, a replay that changes
 * nothing, the subscriber's own changes (cancel in one step, pause, resume, the 14-day withdrawal),
 * invoices with their tax, and entitlements that hold while the gateway is unreachable.
 */
let h: Harness;
const SECRET = 'test-fake-payments-secret'; // createApi's default fake gateway

beforeAll(async () => {
  h = await startHarness({});
});
afterAll(async () => {
  await h.close();
});

/** Applies every stored webhook the way the worker does (no gateway call: interpret is pure). */
const settle = () =>
  processPendingWebhooks({ db: h.db, log, email: h.email, provider: { name: 'fake', interpret: (p: unknown) => (p as { data: never }).data } as unknown as PaymentProvider });

async function signedIn() {
  const email = await registered(h);
  const { accessToken } = await mobileLogin(h, email);
  const headers = { authorization: `Bearer ${accessToken}`, 'x-nextkin-client': 'mobile', 'content-type': 'application/json' };
  const user = await h.db.withSystem('test: find the user', (tx) => tx.selectFrom('users').select('id').where('email', '=', email).executeTakeFirstOrThrow());
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await h.app.request(`/api/v1${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: (await res.json().catch(() => null)) as Record<string, unknown> | null, res };
  };
  return { email, userId: user.id, call };
}

async function buyPro(call: Awaited<ReturnType<typeof signedIn>>['call'], planId: 'pro_monthly' | 'pro_annual' = 'pro_monthly') {
  const checkout = await call('POST', '/billing/checkout', { planId, country: 'DE' });
  expect(checkout.status).toBe(200);
  const url = new URL(String(checkout.body!.url));
  const page = await h.app.request(url.pathname);
  expect(page.status).toBe(200);
  expect(await page.text()).toContain('Test checkout');
  const paid = await h.app.request(`${url.pathname}/complete`, { method: 'POST' });
  expect(paid.status).toBe(303);
  expect(paid.headers.get('location')).toContain('checkout=success');
  await settle();
}

describe('billing (P12-06…P12-10)', () => {
  it('prices the plans by billing country, with the annual saving rounded down', async () => {
    const plans = (await (await h.app.request('/api/v1/billing/plans?country=DE')).json()) as { data: { id: string; price: { amount: number; currency: string }; badge?: string }[] };
    expect(plans.data.map((p) => [p.id, p.price.amount, p.price.currency])).toEqual([
      ['free', 0, 'EUR'],
      ['pro_annual', 109, 'EUR'],
      ['pro_monthly', 19, 'EUR'],
    ]);
    // 19 × 12 = 228 against 109: a saving of 52.2%, published as 52.
    expect(plans.data.find((p) => p.id === 'pro_annual')!.badge).toBe('Save 52%');
    const aud = (await (await h.app.request('/api/v1/billing/plans?country=AU')).json()) as { data: { id: string; price: { amount: number } }[] };
    expect(aud.data.find((p) => p.id === 'pro_monthly')!.price.amount).toBe(29);
  });

  it('a hosted checkout becomes Pro only through its verified webhooks, with an invoice and its VAT', async () => {
    const { email, call } = await signedIn();
    const before = await call('GET', '/me/subscription');
    expect(before.body).toMatchObject({ plan: 'free', usage: { generationsLimit: 3, assistantMessagesLimit: 20 } });
    expect(String((before.body!.usage as { resetsAt: string }).resetsAt)).toMatch(/-01T00:00:00/);

    await buyPro(call);
    const after = await call('GET', '/me/subscription');
    expect(after.body).toMatchObject({ plan: 'pro', status: 'active', planId: 'pro_monthly', cancelAtPeriodEnd: false, usage: { generationsLimit: 100, assistantMessagesLimit: 100 } });

    const billing = (await call('GET', '/billing')).body as { paymentMethods: { last4: string }[]; invoices: { amount: { amount: number; currency: string }; tax: number; number: string }[]; settings: { autoRenew: boolean; cycle: string } };
    expect(billing.paymentMethods[0]!.last4).toBe('4242');
    expect(billing.invoices).toHaveLength(1);
    expect(billing.invoices[0]).toMatchObject({ amount: { amount: 19, currency: 'EUR' }, tax: 3.03 });
    expect(billing.invoices[0]!.number).toMatch(/^NK-\d{4}-\d{6}$/);
    expect(billing.settings).toEqual({ autoRenew: true, cycle: 'monthly' });
    // §13.4: every charge is invoiced by email, with its tax.
    expect(h.email.lastTo(email)?.text).toContain('Includes VAT: 3.03 EUR');

    // Buying twice is refused.
    expect((await call('POST', '/billing/checkout', { planId: 'pro_annual' })).status).toBe(409);
  });

  it('a replayed webhook changes nothing, and a forged one is refused', async () => {
    const { userId, call } = await signedIn();
    await buyPro(call);
    const stored = await h.db.withSystem('test: read a stored webhook', (tx) =>
      tx.selectFrom('webhook_events as w').select(['w.payload', 'w.event_id']).where('w.type', '=', 'invoice.paid').orderBy('w.received_at', 'desc').executeTakeFirstOrThrow(),
    );
    const raw = JSON.stringify(stored.payload);
    const sign = (body: string) => createHmac('sha256', SECRET).update(body).digest('hex');
    const replay = await h.app.request('/api/v1/billing/webhooks/fake', { method: 'POST', headers: { 'content-type': 'application/json', [FAKE_SIGNATURE_HEADER]: sign(raw) }, body: raw });
    expect(replay.status).toBe(200);
    expect(await settle()).toBe(0);
    const payments = await h.db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('payments').select('id').execute());
    expect(payments).toHaveLength(1);

    const forged = await h.app.request('/api/v1/billing/webhooks/fake', { method: 'POST', headers: { 'content-type': 'application/json', [FAKE_SIGNATURE_HEADER]: 'nope' }, body: raw });
    expect(forged.status).toBe(400);
    expect((await h.app.request('/api/v1/billing/webhooks/stripe', { method: 'POST', body: raw })).status).toBe(404);
  });

  it('cancel in one step keeps Pro to period end; pause drops to Free until resumed', async () => {
    const { email, call } = await signedIn();
    await buyPro(call);

    await call('POST', '/billing/cancel');
    await settle();
    expect((await call('GET', '/me/subscription')).body).toMatchObject({ plan: 'pro', cancelAtPeriodEnd: true });
    expect(h.email.lastTo(email)?.subject).toBe('Your NextKin Pro cancellation');
    await call('POST', '/billing/resume');
    await settle();
    expect((await call('GET', '/me/subscription')).body).toMatchObject({ plan: 'pro', cancelAtPeriodEnd: false });

    await call('POST', '/billing/pause', { months: 2 });
    await settle();
    const paused = (await call('GET', '/me/subscription')).body!;
    expect(paused).toMatchObject({ plan: 'free', status: 'paused' });
    expect(paused.pausedUntil).toBeTruthy();
    await call('POST', '/billing/resume');
    await settle();
    expect((await call('GET', '/me/subscription')).body).toMatchObject({ plan: 'pro', status: 'active' });

    // A new cycle is a plan change the gateway prorates.
    await call('PATCH', '/billing/settings', { cycle: 'annual' });
    await settle();
    expect((await call('GET', '/me/subscription')).body).toMatchObject({ planId: 'pro_annual' });
  });

  it('withdrawal within 14 days ends Pro now and refunds the payment', async () => {
    const { call } = await signedIn();
    await buyPro(call);
    const done = await call('POST', '/billing/withdraw');
    expect(done.status).toBe(200);
    await settle();
    expect((await call('GET', '/me/subscription')).body).toMatchObject({ plan: 'free' });
    const billing = (await call('GET', '/billing')).body as { invoices: { status: string }[] };
    expect(billing.invoices[0]!.status).toBe('refunded');
  });

  it('paying users keep their features while the gateway is unreachable (P12-08)', async () => {
    const { userId, call } = await signedIn();
    await buyPro(call);
    // Entitlements read our own tables only: no provider is involved in reading them.
    const sub = await getSubscription(h.db, { userId, role: 'user' });
    expect(sub.plan).toBe('pro');
  });
});
