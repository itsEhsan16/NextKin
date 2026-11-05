import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMockModeStore } from '../src/mock';
import { BusinessRefusedError, createMockAdminBusinessRepo } from '../src/repos/adminBusinessRepo';
import { resetAdminMocks } from '../src/repos/adminMockReset';
import { createHttpAdminBusinessRepo } from '../src/repos/http/adminBusinessRepo';
import { createHttpClient } from '../src/repos/http/client';

/** The admin Business area (Figma 406:2873, 407:1430, 408:3596). Synthetic records only. */

describe('the mock Business repository', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 50 });
    useMockModeStore.setState({ mode: 'normal' });
    resetAdminMocks();
  });

  it('retires the current price version when it publishes a new one', async () => {
    const repo = createMockAdminBusinessRepo();
    const monthly = { USD: 2100, EUR: 2100, AUD: 3200 };
    const annual = { USD: 11900, EUR: 11900, AUD: 17900 };
    await repo.createPriceVersion({ monthly, annual });

    const book = (await repo.priceBook())!;
    expect(book.map((v) => [v.version, v.status])).toEqual([
      [4, 'active'],
      [3, 'retired'],
      [2, 'retired'],
      [1, 'retired'],
    ]);
    const plans = await repo.plans();
    expect(plans.find((p) => p.id === 'pro_monthly')!.prices).toEqual(monthly);
  });

  it('refuses a price on the Free plan, and a price of zero', async () => {
    const repo = createMockAdminBusinessRepo();
    await expect(
      repo.setPlanPrices('free', { USD: 100, EUR: 100, AUD: 100 }),
    ).rejects.toMatchObject({ code: 'free_plan_price' });
    await expect(
      repo.setPlanPrices('pro_monthly', { USD: 0, EUR: 100, AUD: 100 }),
    ).rejects.toBeInstanceOf(BusinessRefusedError);
  });

  it('sets a quota unlimited with null and records who changed it', async () => {
    const repo = createMockAdminBusinessRepo();
    const plan = await repo.setQuotas('free', { generation: null, cover_letter: 5 });
    expect(plan.quotas.find((q) => q.key === 'generation')!.limit).toBeNull();
    expect(plan.quotas.find((q) => q.key === 'cover_letter')!.limit).toBe(5);
    expect(plan.quotasChanged!.by).toBe('Ehsan');
  });

  it('pages comped access four at a time and adds a grant at the top', async () => {
    const repo = createMockAdminBusinessRepo();
    expect(await repo.comps(1)).toMatchObject({ page: 1, pages: 2, active: 6 });
    await repo.grantComp({ userRef: 'usr_1234abcd', months: 2, reason: 'Partner pilot' });
    const first = (await repo.comps(1))!;
    expect(first.active).toBe(7);
    expect(first.rows[0]).toMatchObject({ userRef: 'usr_1234abcd', months: 2 });
  });

  it('never keeps a provider key, only that one is set', async () => {
    const repo = createMockAdminBusinessRepo();
    await repo.setProviderKey('jooble', 'sk-live-very-secret-key');
    const providers = await repo.providers();
    expect(JSON.stringify(providers)).not.toContain('very-secret');
    expect(providers.find((p) => p.provider === 'jooble')!.key.set).toBe(true);
  });

  it('pauses a provider and claims no health when it comes back', async () => {
    const repo = createMockAdminBusinessRepo();
    expect((await repo.setProviderEnabled('adzuna', false)).health).toBe('paused');
    expect((await repo.setProviderEnabled('adzuna', true)).health).toBeNull();
  });

  it('drops the pre-pause trend and enforces attribution again when a provider comes back', async () => {
    const repo = createMockAdminBusinessRepo();
    const paused = await repo.setProviderEnabled('jooble', false);
    expect(paused.attribution?.state).toBe('enforced_when_enabled');
    const back = await repo.setProviderEnabled('remotive', true);
    expect(back.errorTrend).toEqual([]);
    expect(back.errorRate).toBeNull();
    expect(back.attribution?.state).toBe('shown');
  });

  it('serves an empty window as empty sections, not missing ones', async () => {
    useMockModeStore.setState({ mode: 'empty' });
    const page = await createMockAdminBusinessRepo().analytics('30d');
    expect(page.funnel).toEqual({ conversion: 0, deltaPoints: null, steps: [] });
    expect(page.quota?.rows).toEqual([]);
  });
});

describe('the Business repository over HTTP', () => {
  const respond = (routes: Record<string, unknown>) =>
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const path = Object.keys(routes).find((route) => new URL(url).pathname.endsWith(route));
      return new Response(JSON.stringify(path ? routes[path] : { error: { code: 'NOT_FOUND' } }), {
        status: path ? 200 : 404,
        headers: { 'content-type': 'application/json' },
      });
    });

  it('answers from the server, never from a fixture', async () => {
    const http = createHttpClient({
      baseUrl: 'http://api.test/api/v1',
      client: 'web',
      fetch: respond({
        '/admin/analytics/report': {
          range: '7d',
          funnel: { conversion: 0, deltaPoints: null, steps: [] },
          generations: {
            rows: [{ kind: 'resume', count: 2 }],
            total: 2,
            perActiveUser: 2,
            failed: 2,
            failedRate: 1,
            p95Seconds: null,
          },
          ats: {
            mean: null,
            deltaPoints: null,
            median: null,
            rubricVersion: null,
            buckets: Array.from({ length: 10 }, (_, i) => ({
              from: i * 10,
              to: i * 10 + 10,
              count: i === 9 ? 1 : 0,
            })),
          },
          quota: { planLabel: 'Free plan', atCapShare: 0, deltaPoints: null, rows: [] },
          providerUsage: { rows: [], totalUsd: 0 },
        },
        '/admin/metrics/retention': {
          data: [{ week: '2026-09-07', activated: 10, returned: 4, rate: 0.4, complete: true }],
        },
      }) as unknown as typeof fetch,
    });
    const repo = createHttpAdminBusinessRepo(http);

    // No price-book route answering: the read fails, rather than showing the mock's history.
    await expect(repo.priceBook()).rejects.toBeTruthy();
    const page = await repo.analytics('7d');
    expect(page.funnel!.steps).toEqual([]);
    expect(page.quota!.rows).toEqual([]);
    expect(page.generations).toMatchObject({ total: 2, failed: 2, p95Seconds: null });
    expect(page.ats!.buckets[9]!.count).toBe(1);
    expect(page.retention!.cohorts[0]!.weeks[4]).toEqual({ rate: 0.4 });
    expect(page.retention!.cohorts[0]!.weeks[2]).toEqual({ state: 'unmeasured' });
    expect(page.providerUsage!.rows).toEqual([]);
  });
});
