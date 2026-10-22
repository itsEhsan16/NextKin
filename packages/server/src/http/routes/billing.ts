import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { billingSchema, billingSettingsPatchSchema, checkoutBodySchema, checkoutResultSchema, pauseBodySchema, planListSchema, subscriptionSchema } from '@nextkin/shared/schemas/billing';

import { isFake } from '../../payments/build';
import { WebhookSignatureError } from '../../payments/types';
import * as billing from '../../services/billing';
import { ingestWebhook } from '../../services/billingWebhooks';
import type { ApiEnv } from '../env';
import { errors } from '../errors';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * Billing (spec §11, §13; ImBackendImplementationPlan P12-06…P12-10). The plans and the account's
 * subscription and meters; a hosted checkout; the changes a subscriber makes themselves (auto-renew,
 * the cycle, cancel in one step, pause, the 14-day withdrawal); and the gateway's webhooks, verified
 * and persisted before anything is done with them. With the fake provider (local and test only),
 * `/billing/fake-checkout/{token}` stands in for the hosted page.
 */

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const errs = { ...authErrors, ...notFoundError, ...commonErrors };

const escapeHtml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]!);

export function billingRoutes(deps: billing.BillingDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const { db } = deps;

  app.openapi(
    createRoute({ method: 'get', path: '/billing/plans', tags: ['billing'], summary: 'The plans, priced in the account’s currency (or the country asked about). No session needed.', request: { query: z.object({ country: z.string().regex(/^[A-Z]{2}$/).optional() }) }, responses: { 200: ok('Plans.', planListSchema), ...commonErrors } }),
    async (c) => c.json(checked(planListSchema, { data: await billing.listPlans(db, c.get('auth')?.identity ?? null, c.req.valid('query').country) }), 200),
  );

  app.openapi(createRoute({ method: 'get', path: '/me/subscription', tags: ['billing'], summary: 'The plan, its status and every meter with its reset date (§13.3, §13.5).', responses: { 200: ok('The subscription.', subscriptionSchema), ...errs } }), async (c) =>
    c.json(checked(subscriptionSchema, await billing.getSubscription(db, requireAuth(c).identity)), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/billing/checkout', tags: ['billing'], summary: 'Start a hosted checkout; the plan changes when its verified webhook lands.', request: { body: json(checkoutBodySchema) }, responses: { 200: ok('Where to send the user.', checkoutResultSchema), 409: { description: 'Already on Pro (CONFLICT).' }, ...errs } }),
    async (c) => {
      const body = c.req.valid('json');
      return c.json(checked(checkoutResultSchema, await billing.startCheckout(deps, requireAuth(c).identity, body.planId, { ...(body.country ? { country: body.country } : {}), ...(body.returnPath ? { returnPath: body.returnPath } : {}) })), 200);
    },
  );

  app.openapi(createRoute({ method: 'get', path: '/billing', tags: ['billing'], summary: 'The card on file, the renewal settings and the invoices.', responses: { 200: ok('Billing.', billingSchema), ...errs } }), async (c) =>
    c.json(checked(billingSchema, await billing.getBilling(db, requireAuth(c).identity)), 200),
  );

  app.openapi(
    createRoute({ method: 'patch', path: '/billing/settings', tags: ['billing'], summary: 'Auto-renew (off is a period-end cancellation) and the billing cycle (prorated by the gateway).', request: { body: json(billingSettingsPatchSchema) }, responses: { 200: ok('Billing.', billingSchema), ...errs } }),
    async (c) => c.json(checked(billingSchema, await billing.updateBillingSettings(deps, requireAuth(c).identity, c.req.valid('json'))), 200),
  );

  app.openapi(createRoute({ method: 'post', path: '/billing/cancel', tags: ['billing'], summary: 'Cancel in one step, effective at period end, confirmed by email (the Kündigungsbutton).', responses: { 200: ok('The subscription.', subscriptionSchema), ...errs } }), async (c) =>
    c.json(checked(subscriptionSchema, await billing.cancelSubscription(deps, requireAuth(c).identity)), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/billing/pause', tags: ['billing'], summary: 'Pause for one to three months instead of cancelling (§13.6).', request: { body: json(pauseBodySchema) }, responses: { 200: ok('The subscription.', subscriptionSchema), ...errs } }),
    async (c) => c.json(checked(subscriptionSchema, await billing.pauseSubscription(deps, requireAuth(c).identity, c.req.valid('json').months)), 200),
  );

  app.openapi(createRoute({ method: 'post', path: '/billing/resume', tags: ['billing'], summary: 'End a pause, or undo a pending cancellation.', responses: { 200: ok('The subscription.', subscriptionSchema), ...errs } }), async (c) =>
    c.json(checked(subscriptionSchema, await billing.resumeSubscription(deps, requireAuth(c).identity)), 200),
  );

  app.openapi(createRoute({ method: 'post', path: '/billing/withdraw', tags: ['billing'], summary: 'The 14-day withdrawal: end now and refund the first payment.', responses: { 200: ok('The subscription.', subscriptionSchema), 409: { description: 'Past the 14 days (CONFLICT).' }, ...errs } }), async (c) =>
    c.json(checked(subscriptionSchema, await billing.withdraw(deps, requireAuth(c).identity)), 200),
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/billing/webhooks/{provider}',
      tags: ['billing'],
      summary: 'The gateway’s webhooks: verified, persisted, then processed by the worker. A replay changes nothing.',
      request: { params: z.object({ provider: z.enum(['stripe', 'fake']) }) },
      responses: { 200: { description: 'Accepted.' }, ...notFoundError, ...commonErrors, 400: { description: 'The signature does not verify.' } },
    }),
    async (c) => {
      if (c.req.valid('param').provider !== deps.provider.name) throw errors.notFound('webhook endpoint');
      const raw = await c.req.text();
      const headers = Object.fromEntries([...c.req.raw.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
      try {
        await ingestWebhook({ db, provider: deps.provider, log: deps.log }, raw, headers);
      } catch (error) {
        if (error instanceof WebhookSignatureError) throw errors.validation({ signature: 'invalid' }, error.message);
        throw error;
      }
      return c.json({ received: true }, 200);
    },
  );

  // The fake gateway's hosted page (local and test only: the fake provider is refused elsewhere).
  app.openapi(
    createRoute({ method: 'get', path: '/billing/fake-checkout/{token}', tags: ['billing'], summary: 'Local only: the fake gateway’s checkout page.', request: { params: z.object({ token: z.string().max(2000) }) }, responses: { 200: { description: 'HTML.', content: { 'text/html': { schema: z.string() } } }, ...notFoundError } }),
    async (c) => {
      const provider = deps.provider;
      const session = isFake(provider) ? provider.readSession(c.req.valid('param').token) : null;
      if (!session) throw errors.notFound('checkout');
      const price = `${(session.amountMinor / 100).toFixed(2)} ${session.currency} / ${session.period}`;
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test checkout</title></head><body style="font-family:system-ui;max-width:420px;margin:48px auto;padding:0 16px"><h1>Test checkout</h1><p>The local fake gateway. No card is charged.</p><p><strong>${escapeHtml(session.planId === 'pro_annual' ? 'NextKin Pro (annual)' : 'NextKin Pro (monthly)')}</strong><br>${escapeHtml(price)}</p><form method="post" action="${escapeHtml(c.req.path)}/complete"><button type="submit" style="padding:12px 20px">Pay (test)</button></form><p><a href="${escapeHtml(session.cancelUrl)}">Cancel</a></p></body></html>`;
      return c.html(html, 200);
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/billing/fake-checkout/{token}/complete', tags: ['billing'], summary: 'Local only: pay a fake checkout; its signed webhooks are delivered and the browser returns to the app.', request: { params: z.object({ token: z.string().max(2000) }) }, responses: { 303: { description: 'Back to the app.' }, ...notFoundError } }),
    async (c) => {
      const provider = deps.provider;
      if (!isFake(provider) || !provider.readSession(c.req.valid('param').token)) throw errors.notFound('checkout');
      const session = await provider.completeCheckout(c.req.valid('param').token);
      return c.redirect(session.successUrl, 303);
    },
  );

  return app;
}
