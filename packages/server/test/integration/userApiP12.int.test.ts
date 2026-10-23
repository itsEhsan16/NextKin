import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PaymentProvider } from '../../src/payments/types';
import { processPendingWebhooks } from '../../src/services/billingWebhooks';
import { log } from './fixtures/pipeline';
import { mobileLogin, registered, startHarness, type Harness } from './fixtures/authHarness';

/**
 * P12-14 through the shared client both apps run: consent, a hosted checkout to Pro (the fake
 * gateway's page, then its webhooks), billing, the meters, support, the data export and deletion,
 * all on the `user` and `support` HTTP repositories with no mock fallback.
 */
let h: Harness;
beforeAll(async () => {
  h = await startHarness({ files: true });
});
afterAll(async () => {
  await h.close();
});

describe('user and support over the apps’ HTTP repositories (P12-14)', () => {
  it('consents, buys Pro through checkout, reads billing, asks for help, exports and deletes', async () => {
    const { createRepos, mockFallbacks } = await import('@nextkin/shared/repos/create');
    const { createMockRepos } = await import('@nextkin/shared/repos');
    const { createMockStore } = await import('@nextkin/shared/repos/state');
    const { createHttpClient } = await import('@nextkin/shared/repos/http/client');

    const email = await registered(h);
    const tokens = await mobileLogin(h, email, undefined, { consent: false });
    let stored = { ...tokens, expiresIn: 3600 };
    const http = createHttpClient({
      baseUrl: 'http://localhost:3000',
      client: 'mobile',
      tokens: { get: async () => stored, set: async (next) => void (next && (stored = next)) },
      fetch: (input, init) => h.app.request(String(input), init) as Promise<Response>,
    });
    const config = { sources: { user: 'http' as const, support: 'http' as const }, http };
    expect(mockFallbacks(config)).toEqual([]);
    const { repos } = createRepos(config, createMockRepos(createMockStore()));

    const consent = await repos.user.getAiConsent();
    expect(consent.granted).toBe(false);
    expect((await repos.user.grantAiConsent(consent.current.version)).granted).toBe(true);

    expect((await repos.user.getSubscription()).plan).toBe('free');
    const plans = await repos.user.listPlans();
    expect(plans.find((p) => p.id === 'pro_monthly')!.price).toEqual({ amount: 19, currency: 'USD', period: 'month' });
    const started = await repos.user.upgrade('pro_monthly');
    expect(started.kind).toBe('checkout');
    const url = new URL(started.kind === 'checkout' ? started.url : '');
    expect((await h.app.request(`${url.pathname}/complete`, { method: 'POST' })).status).toBe(303);
    await processPendingWebhooks({ db: h.db, log, email: h.email, provider: { name: 'fake', interpret: (p: unknown) => (p as { data: never }).data } as unknown as PaymentProvider });
    expect(await repos.user.getSubscription()).toMatchObject({ plan: 'pro', planId: 'pro_monthly' });
    const billing = await repos.user.getBilling();
    expect(billing.invoices[0]!.amount).toEqual({ amount: 19, currency: 'USD' });

    expect((await repos.support.listFaq()).length).toBeGreaterThan(0);
    expect((await repos.support.getLegal('privacy')).key).toBe('privacy');
    const ticket = await repos.support.submitTicket({ topic: 'question', message: 'How do I export?' });
    expect(ticket.email).toBe(email);

    expect((await repos.user.requestDataExport()).status).toBe('preparing');
    expect((await repos.user.getDataExport()).status).toBe('preparing');

    await repos.user.deleteAccount();
    await expect(repos.user.getCurrentUser()).rejects.toBeTruthy();
  }, 90_000);
});
