import { describe, expect, it, vi } from 'vitest';

import type { PriceSet } from '../src/models/adminBusiness';
import { BusinessRefusedError } from '../src/repos/adminBusinessRepo';
import { createHttpAdminBusinessRepo } from '../src/repos/http/adminBusinessRepo';
import { createHttpClient } from '../src/repos/http/client';

/**
 * The Business HTTP repository against the server's real contract (`packages/server/src/http/
 * routes/admin.ts`). Each fake response copies what the named service function returns.
 */

type Call = { method: string; url: string; path: string; body: unknown };
type Reply = { status?: number; body?: unknown };
type Route = Reply | ((call: Call) => Reply);

const envelope = (code: string, message: string, details: unknown = null) => ({
  error: { code, message, details, request_id: 'req_1' },
});

/** A fake API: answers `METHOD /path` from `routes` and records every request sent to it. */
function fakeApi(routes: Record<string, Route>) {
  const calls: Call[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const url = String(input);
    const call: Call = {
      method: init?.method ?? 'GET',
      url,
      path: new URL(url).pathname.replace(/^\/api\/v1/, ''),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const route = routes[`${call.method} ${call.path}`];
    const reply: Reply =
      typeof route === 'function'
        ? route(call)
        : (route ?? { status: 404, body: envelope('NOT_FOUND', 'No such endpoint.') });
    return new Response(JSON.stringify(reply.body ?? null), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  const http = createHttpClient({
    baseUrl: 'http://api.test',
    client: 'web',
    fetch,
    retryDelayMs: () => 0,
  });
  return { repo: createHttpAdminBusinessRepo(http), calls };
}

/** The calls a test is about: the stats reads that ride along with a list are left out. */
const main = (calls: Call[]) => calls.filter((c) => !c.path.endsWith('/stats'));

type PlanRow = {
  id: string;
  tier: string;
  name: string;
  period: string | null;
  prices: Record<string, number>;
  price_version: number;
  quotas: Record<string, number | boolean | null>;
  active: boolean;
};

/**
 * `catalog.listPlans` over the reference seed (`seed/reference.ts`): ordered by id, the Free plan
 * with no period and no prices, quota keys in jsonb's stored order (length, then bytes), and the
 * `docx` / `priority_queue` feature flags inside `quotas`.
 */
const seedPlans = (): PlanRow[] => [
  {
    id: 'free',
    tier: 'free',
    name: 'NextKin Free',
    period: null,
    prices: {},
    price_version: 1,
    quotas: {
      docx: false,
      ats_check: 3,
      generation: 3,
      saved_jobs: 10,
      zero_resume: 1,
      cover_letter: 1,
      versions_visible: 3,
      assistant_message_daily: 20,
      interview_set_per_resume: 1,
    },
    active: true,
  },
  {
    id: 'pro_annual',
    tier: 'pro',
    name: 'NextKin Pro (annual)',
    period: 'year',
    prices: { AUD: 16500, EUR: 10900, USD: 10900 },
    price_version: 1,
    quotas: {
      docx: true,
      ats_check: 30,
      generation: 100,
      saved_jobs: null,
      zero_resume: null,
      cover_letter: null,
      priority_queue: true,
      versions_visible: 20,
      assistant_message_daily: 100,
      interview_set_per_resume: null,
    },
    active: true,
  },
  {
    id: 'pro_monthly',
    tier: 'pro',
    name: 'NextKin Pro',
    period: 'month',
    prices: { AUD: 2900, EUR: 1900, USD: 1900 },
    price_version: 1,
    quotas: {
      docx: true,
      ats_check: 30,
      generation: 100,
      saved_jobs: null,
      zero_resume: null,
      cover_letter: null,
      priority_queue: true,
      versions_visible: 20,
      assistant_message_daily: 100,
      interview_set_per_resume: null,
    },
    active: true,
  },
];

/** A stateful `/admin/plans` (`listPlans`, `setPlanPrices`, `setPlanQuotas`). */
function plansApi() {
  const plans = seedPlans();
  const find = (call: Call) => plans.find((p) => call.path.split('/')[3] === p.id)!;
  const routes: Record<string, Route> = {
    'GET /admin/plans': () => ({ body: { data: plans } }),
    // `business.createPriceVersion`: both Pro plans in one version.
    'POST /admin/price-book': (call) => {
      const body = call.body as { monthly: Record<string, number>; annual: Record<string, number> };
      plans.find((p) => p.id === 'pro_monthly')!.prices = body.monthly;
      plans.find((p) => p.id === 'pro_annual')!.prices = body.annual;
      return { body: { version: 2 } };
    },
  };
  for (const plan of plans) {
    routes[`PUT /admin/plans/${plan.id}/prices`] = (call) => {
      const row = find(call);
      if (row.tier === 'free') {
        return { status: 409, body: envelope('CONFLICT', 'The Free plan has no price.') };
      }
      row.prices = call.body as Record<string, number>;
      row.price_version += 1;
      // `setPlanPrices` returns the new prices and version.
      return { body: { prices: row.prices, price_version: row.price_version } };
    };
    routes[`PATCH /admin/plans/${plan.id}/quotas`] = (call) => {
      const row = find(call);
      row.quotas = { ...row.quotas, ...(call.body as Record<string, number | null>) };
      // `setPlanQuotas` returns the merged quotas.
      return { body: row.quotas };
    };
  }
  return fakeApi(routes);
}

describe('plans', () => {
  it('reads every plan, Free included, in the board’s order, listing only quotas', async () => {
    const { repo, calls } = plansApi();
    const plans = await repo.plans();

    expect(main(calls).map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET http://api.test/api/v1/admin/plans',
    ]);
    expect(plans.map((p) => [p.id, p.tier, p.period])).toEqual([
      ['free', 'free', 'month'],
      ['pro_monthly', 'pro', 'month'],
      ['pro_annual', 'pro', 'year'],
    ]);
    const [free, monthly] = plans;
    expect(free).toMatchObject({
      name: 'NextKin Free',
      prices: { USD: 0, EUR: 0, AUD: 0 },
      // Without `/admin/plans/stats` no head count is claimed (the row's `active` is "offered").
      active: null,
      activeDelta: null,
      quotasChanged: null,
    });
    expect(free!.quotas).toEqual([
      { key: 'generation', label: 'Generations per month', per: 'month', limit: 3 },
      { key: 'cover_letter', label: 'Cover letters per month', per: 'month', limit: 1 },
      { key: 'ats_check', label: 'ATS checks per month', per: 'month', limit: 3 },
      {
        key: 'interview_set_per_resume',
        label: 'Interview question sets',
        per: 'resume',
        limit: 1,
      },
      { key: 'zero_resume', label: 'Zero Resume', per: 'month', limit: 1 },
      {
        key: 'assistant_message_daily',
        label: 'Assistant messages per day',
        per: 'month',
        limit: 20,
      },
      { key: 'saved_jobs', label: 'Saved jobs per account', per: 'month', limit: 10 },
      { key: 'versions_visible', label: 'Visible versions', per: 'resume', limit: 3 },
    ]);
    expect(monthly!.prices).toEqual({ USD: 1900, EUR: 1900, AUD: 2900 });
    expect(monthly!.quotas.map((q) => q.key)).not.toContain('docx');
    expect(monthly!.quotas.find((q) => q.key === 'cover_letter')!.limit).toBeNull();
  });

  it('sets one plan’s prices in exactly the three currencies, then reads it back', async () => {
    const { repo, calls } = plansApi();
    const extra = { USD: 2100, EUR: 2000, AUD: 3100, INR: 99_900 } as PriceSet;
    const plan = await repo.setPlanPrices('pro_monthly', extra);

    expect(main(calls).map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /admin/plans',
      'POST /admin/price-book',
      'GET /admin/plans',
    ]);
    // A new book version: the annual plan keeps its prices. The route's body is `.strict()`, so a
    // fourth currency would be refused.
    expect(main(calls)[1]!.body).toEqual({
      monthly: { USD: 2100, EUR: 2000, AUD: 3100 },
      annual: { USD: 10900, EUR: 10900, AUD: 16500 },
    });
    expect(plan.prices).toEqual({ USD: 2100, EUR: 2000, AUD: 3100 });
  });

  it('refuses the Free plan and a zero price with the mock’s codes, sending nothing', async () => {
    const { repo, calls } = plansApi();
    const price = { USD: 100, EUR: 100, AUD: 100 };
    await expect(repo.setPlanPrices('free', price)).rejects.toMatchObject({
      name: 'BusinessRefusedError',
      code: 'free_plan_price',
    });
    expect(main(calls).map((c) => c.method)).toEqual(['GET']);

    await expect(repo.setPlanPrices('pro_monthly', { ...price, EUR: 0 })).rejects.toMatchObject({
      code: 'invalid_price',
    });
    await expect(repo.setPlanPrices('pro_monthly', { ...price, AUD: 9.5 })).rejects.toBeInstanceOf(
      BusinessRefusedError,
    );
    expect(main(calls)).toHaveLength(1);
  });

  it('a new price version sets both Pro plans in one request', async () => {
    const { repo, calls } = plansApi();
    const monthly = { USD: 2100, EUR: 2100, AUD: 3100 };
    const annual = { USD: 11900, EUR: 11900, AUD: 17500 };
    await repo.createPriceVersion({ monthly, annual });

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /admin/price-book']);
    expect(calls[0]!.body).toEqual({ monthly, annual });
  });

  it('checks both price sets before it sends either', async () => {
    const { repo, calls } = plansApi();
    await expect(
      repo.createPriceVersion({
        monthly: { USD: 2100, EUR: 2100, AUD: 3100 },
        annual: { USD: 11900, EUR: -1, AUD: 17500 },
      }),
    ).rejects.toMatchObject({ code: 'invalid_price' });
    expect(calls).toHaveLength(0);
  });

  it('saves quotas (null is unlimited) without keys that aren’t quotas', async () => {
    const { repo, calls } = plansApi();
    const plan = await repo.setQuotas('free', { generation: 5, saved_jobs: null, docx: 1 });

    expect(main(calls).map((c) => `${c.method} ${c.path}`)).toEqual([
      'PATCH /admin/plans/free/quotas',
      'GET /admin/plans',
    ]);
    // `setPlanQuotas` refuses keys outside QUOTA_KEYS, and `docx` is a feature flag.
    expect(calls[0]!.body).toEqual({ generation: 5, saved_jobs: null });
    expect(plan.quotas.find((q) => q.key === 'generation')!.limit).toBe(5);
    expect(plan.quotas.find((q) => q.key === 'saved_jobs')!.limit).toBeNull();
  });

  it('with no quota left to save it sends no write, so no audit row says quotas changed', async () => {
    const { repo, calls } = plansApi();
    const plan = await repo.setQuotas('free', { docx: 1 });
    expect(main(calls).map((c) => `${c.method} ${c.path}`)).toEqual(['GET /admin/plans']);
    expect(plan.id).toBe('free');
  });

  it('refuses a quota that isn’t a whole number of 0 or more, sending nothing', async () => {
    const { repo, calls } = plansApi();
    await expect(repo.setQuotas('free', { generation: -1 })).rejects.toMatchObject({
      code: 'invalid_quota',
    });
    await expect(repo.setQuotas('free', { ats_check: 2.5 })).rejects.toMatchObject({
      code: 'invalid_quota',
    });
    expect(calls).toHaveLength(0);
  });

  it('adds who is on each plan and the last quota change from /admin/plans/stats', async () => {
    const { repo } = fakeApi({
      'GET /admin/plans': { body: { data: seedPlans() } },
      // `business.planStats`.
      'GET /admin/plans/stats': {
        body: {
          active: { free: 40, pro_monthly: 7 },
          quotasChanged: { free: { at: '2026-11-02T10:00:00.000Z', by: 'Ehsan' } },
        },
      },
    });
    const [free, monthly, annual] = await repo.plans();
    expect(free).toMatchObject({
      active: 40,
      activeDelta: null,
      quotasChanged: { at: '2026-11-02T10:00:00.000Z', by: 'Ehsan' },
    });
    expect(monthly).toMatchObject({ active: 7, quotasChanged: null });
    // A plan the server doesn't list has no count rather than a guessed one.
    expect(annual!.active).toBeNull();
  });

  it('a server refusal reaches the screen as the server said it', async () => {
    const { repo } = fakeApi({
      'GET /admin/plans': {
        status: 403,
        body: envelope('FORBIDDEN', 'You do not have access to this.'),
      },
    });
    await expect(repo.plans()).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });
});

describe('comped access', () => {
  const USER_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f4f2a';

  it('grants Pro to a user by their full id with the months and the trimmed reason', async () => {
    // `users.grantComp` answers with the date the comp runs to.
    const { repo, calls } = fakeApi({
      [`POST /admin/users/${USER_ID}/comp`]: { body: { until: '2027-02-05T12:00:00.000Z' } },
    });
    await repo.grantComp({ userRef: `  ${USER_ID} `, months: 3, reason: '  Pilot tester  ' });

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST http://api.test/api/v1/admin/users/${USER_ID}/comp`,
    ]);
    expect(calls[0]!.body).toEqual({ months: 3, reason: 'Pilot tester' });
  });

  it('refuses a masked id, months outside 1–12 or a short reason before sending', async () => {
    const { repo, calls } = fakeApi({});
    for (const input of [
      { userRef: '4f2a', months: 3, reason: 'Pilot tester' },
      { userRef: USER_ID, months: 13, reason: 'Pilot tester' },
      { userRef: USER_ID, months: 0, reason: 'Pilot tester' },
      { userRef: USER_ID, months: 3, reason: ' x ' },
      { userRef: USER_ID, months: 3, reason: 'x'.repeat(501) },
    ]) {
      await expect(repo.grantComp(input)).rejects.toMatchObject({ code: 'invalid_comp' });
    }
    expect(calls).toHaveLength(0);
  });

  it('reads the price book, newest first, with the seed version unauthored', async () => {
    // `business.listPriceBook`.
    const { repo, calls } = fakeApi({
      'GET /admin/price-book': {
        body: {
          data: [
            {
              version: 2,
              effectiveFrom: '2026-11-03T10:00:00.000Z',
              monthly: { USD: 2100, EUR: 2000, AUD: 3100 },
              annual: { USD: 11900, EUR: 11500, AUD: 17900 },
              createdBy: { name: 'Ehsan', role: 'admin' },
              status: 'active',
            },
            {
              version: 1,
              effectiveFrom: '2026-10-01T00:00:00.000Z',
              monthly: { USD: 1900, EUR: 1900, AUD: 2900 },
              annual: { USD: 10900, EUR: 10900, AUD: 16500 },
              createdBy: null,
              status: 'retired',
            },
          ],
        },
      },
    });
    const book = await repo.priceBook();
    expect(calls.map((c) => c.path)).toEqual(['/admin/price-book']);
    expect(book!.map((v) => [v.version, v.status, v.createdBy])).toEqual([
      [2, 'active', { name: 'Ehsan', role: 'admin' }],
      [1, 'retired', null],
    ]);
  });

  it('lists comps by page and ends one', async () => {
    // `business.listComps`, `business.endComp`.
    const COMP = 'b1a2c3d4-0000-4000-8000-000000000001';
    const { repo, calls } = fakeApi({
      'GET /admin/comps': {
        body: {
          rows: [
            {
              id: COMP,
              userId: USER_ID,
              months: 3,
              reason: 'Pilot tester',
              grantedBy: { name: 'Priya R.', role: 'support' },
              startedAt: '2026-11-01T00:00:00.000Z',
              endsAt: '2027-02-01T00:00:00.000Z',
            },
            {
              id: 'b1a2c3d4-0000-4000-8000-000000000002',
              userId: USER_ID,
              months: 1,
              reason: null,
              grantedBy: null,
              startedAt: '2026-11-02T00:00:00.000Z',
              endsAt: '2026-12-02T00:00:00.000Z',
            },
          ],
          page: 2,
          pages: 3,
          active: 22,
        },
      },
      [`POST /admin/comps/${COMP}/end`]: { body: { id: COMP } },
    });
    const page = await repo.comps(2);
    expect(calls[0]!.url).toBe('http://api.test/api/v1/admin/comps?page=2');
    expect(page).toMatchObject({ page: 2, pages: 3, active: 22 });
    expect(page!.rows[0]).toEqual({
      id: COMP,
      userRef: USER_ID,
      months: 3,
      reason: 'Pilot tester',
      grantedBy: { name: 'Priya R.', role: 'support' },
      startedAt: '2026-11-01T00:00:00.000Z',
      endsAt: '2027-02-01T00:00:00.000Z',
    });
    // A comp whose grant has no audit row names nobody.
    expect(page!.rows[1]).toMatchObject({ reason: '', grantedBy: null });

    await repo.endComp(COMP);
    expect(calls[1]).toMatchObject({ method: 'POST', path: `/admin/comps/${COMP}/end` });
  });
});

/** `businessAnalytics.analyticsReport` for a window. */
const REPORT = {
  range: '7d',
  funnel: {
    conversion: 0.1,
    deltaPoints: null,
    steps: [
      { key: 'signed_up', label: 'Signed up', count: 20 },
      { key: 'verified_email', label: 'Verified email', count: 18 },
      { key: 'first_resume', label: 'First resume within 72 h', count: 11 },
      { key: 'tailored', label: 'Tailored to a job', count: 6 },
      { key: 'started_pro', label: 'Started Pro', count: 2 },
    ],
  },
  generations: {
    rows: [
      { kind: 'resume', count: 42 },
      { kind: 'tailor', count: 9 },
    ],
    total: 51,
    perActiveUser: 2.55,
    failed: 3,
    failedRate: 3 / 51,
    p95Seconds: 48,
  },
  ats: {
    mean: 71.4,
    deltaPoints: -1.2,
    median: 73,
    rubricVersion: 'v2',
    buckets: Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 10, count: i })),
  },
  quota: {
    planLabel: 'Free plan',
    atCapShare: 0.25,
    deltaPoints: null,
    rows: [{ key: 'generation', cap: 3, atCapShare: 0.2 }],
  },
  providerUsage: {
    rows: [
      {
        tag: 'resume_generate',
        provider: 'anthropic',
        calls: 44,
        tokens: 120_000,
        costUsd: 1.85,
        cacheHitRate: 0.4,
        errorRate: 0.02,
      },
    ],
    totalUsd: 1.85,
  },
};

/** `retention.weekFourRetention`: newest signup week first. */
const RETENTION = {
  data: [
    { week: '2026-10-26', activated: 5, returned: 0, rate: 0, complete: false },
    { week: '2026-09-28', activated: 8, returned: 3, rate: 0.375, complete: true },
    { week: '2026-09-21', activated: 10, returned: 4, rate: 0.4, complete: true },
  ],
};

describe('analytics', () => {
  it('asks for the window on screen and maps the report and week-4 retention', async () => {
    const { repo, calls } = fakeApi({
      'GET /admin/analytics/report': { body: REPORT },
      'GET /admin/metrics/retention': { body: RETENTION },
    });
    const page = await repo.analytics('7d');

    expect(calls.map((c) => c.url).sort()).toEqual([
      'http://api.test/api/v1/admin/analytics/report?range=7d',
      'http://api.test/api/v1/admin/metrics/retention',
    ]);
    expect(page.range).toBe('7d');
    expect(page.funnel).toEqual(REPORT.funnel);
    expect(page.generations!.rows).toEqual([
      { kind: 'resume', label: 'Resume', count: 42 },
      { kind: 'tailor', label: 'Tailor', count: 9 },
    ]);
    expect(page.generations).toMatchObject({ total: 51, perActiveUser: 2.55, p95Seconds: 48 });
    expect(page.ats).toMatchObject({ mean: 71.4, median: 73, rubricVersion: 'v2' });
    expect(page.quota).toEqual({
      planLabel: 'Free plan',
      atCapShare: 0.25,
      deltaPoints: null,
      rows: [{ key: 'generation', label: 'Generations', cap: 'cap 3 a month', atCapShare: 0.2 }],
    });
    expect(page.providerUsage!.rows[0]).toMatchObject({
      tag: 'resume_generate',
      provider: 'Anthropic',
    });

    const { cohorts, week4Average } = page.retention!;
    expect(cohorts.map((c) => [c.label, c.users])).toEqual([
      ['Sep 21', 10],
      ['Sep 28', 8],
      ['Oct 26', 5],
    ]);
    expect(cohorts[0]!.weeks).toEqual([
      { rate: 1 },
      { state: 'unmeasured' },
      { state: 'unmeasured' },
      { state: 'unmeasured' },
      { rate: 0.4 },
      { state: 'unmeasured' },
      { state: 'unmeasured' },
    ]);
    // A week still in progress isn't a final rate.
    expect(cohorts[2]!.weeks[4]).toEqual({ state: 'future' });
    expect(week4Average).toBeCloseTo((0.4 + 0.375) / 2);
  });

  it('without the retention route the rest is served, and retention isn’t', async () => {
    const { repo } = fakeApi({ 'GET /admin/analytics/report': { body: REPORT } });
    const page = await repo.analytics('30d');
    expect(page.retention).toBeNull();
    expect(page.generations!.total).toBe(51);
  });

  it('a failed retention read fails the page instead of claiming it isn’t served', async () => {
    const { repo } = fakeApi({
      'GET /admin/analytics/report': { body: REPORT },
      'GET /admin/metrics/retention': { status: 500, body: envelope('INTERNAL', 'Boom.') },
    });
    await expect(repo.analytics('30d')).rejects.toMatchObject({ code: 'INTERNAL' });
  });
});

type ProviderRow = {
  provider: string;
  enabled: boolean;
  priority: number;
  countries: string[];
  limits: { dailyCalls?: number | null };
  updated_at: string;
  keySet: boolean;
};

/** `catalog.listProviders` over the reference seed: by priority, `keySet` instead of the key. */
const seedProviders = (): ProviderRow[] => [
  {
    provider: 'fixture',
    enabled: true,
    priority: 10,
    countries: [],
    limits: {},
    updated_at: '2026-11-01T09:00:00.000Z',
    keySet: false,
  },
  {
    provider: 'adzuna',
    enabled: false,
    priority: 20,
    countries: ['US', 'DE', 'AU'],
    limits: { dailyCalls: 250 },
    updated_at: '2026-11-01T09:00:00.000Z',
    keySet: true,
  },
  {
    provider: 'jsearch',
    enabled: false,
    priority: 30,
    countries: [],
    limits: {},
    updated_at: '2026-11-01T09:00:00.000Z',
    keySet: false,
  },
];

/** A stateful `/admin/providers` (`listProviders`, `updateProvider`, `setProviderKey`). */
function providersApi() {
  const providers = seedProviders();
  const routes: Record<string, Route> = {
    'GET /admin/providers': () => ({ body: { data: providers } }),
  };
  for (const row of providers) {
    routes[`PATCH /admin/providers/${row.provider}`] = (call) => {
      const patch = call.body as { enabled?: boolean; dailyCalls?: number | null };
      if (patch.enabled !== undefined) row.enabled = patch.enabled;
      if (patch.dailyCalls !== undefined)
        row.limits = { ...row.limits, dailyCalls: patch.dailyCalls };
      return { body: { enabled: row.enabled, priority: row.priority, limits: row.limits } };
    };
    routes[`PUT /admin/providers/${row.provider}/key`] = () => {
      row.keySet = true;
      return { body: { provider: row.provider, keySet: true } };
    };
  }
  return fakeApi(routes);
}

describe('job providers', () => {
  it('reads each provider with its switch, ceiling and whether a key is set', async () => {
    const { repo, calls } = providersApi();
    const providers = await repo.providers();

    expect(main(calls).map((c) => c.url)).toEqual(['http://api.test/api/v1/admin/providers']);
    expect(providers.map((p) => [p.provider, p.label, p.subtitle])).toEqual([
      ['fixture', 'Fixture catalogue', 'All countries'],
      ['adzuna', 'Adzuna', 'US, DE, AU'],
      ['jsearch', 'JSearch', 'All countries'],
    ]);
    expect(providers[1]).toEqual({
      provider: 'adzuna',
      label: 'Adzuna',
      subtitle: 'US, DE, AU',
      enabled: false,
      health: 'paused',
      key: { set: true, addedAt: null, addedBy: null },
      quota: { used: null, ceiling: 250 },
      errorRate: null,
      errorTrend: [],
      errorNote: null,
      attribution: null,
      pausedBy: null,
    });
    // On, but no traffic is served: no health is claimed.
    expect(providers[0]).toMatchObject({ enabled: true, health: null, quota: { ceiling: null } });
  });

  it('switches a provider on and reads it back', async () => {
    const { repo, calls } = providersApi();
    const adzuna = await repo.setProviderEnabled('adzuna', true);

    expect(main(calls).map((c) => `${c.method} ${c.url}`)).toEqual([
      'PATCH http://api.test/api/v1/admin/providers/adzuna',
      'GET http://api.test/api/v1/admin/providers',
    ]);
    expect(calls[0]!.body).toEqual({ enabled: true });
    expect(adzuna).toMatchObject({ enabled: true, health: null });
  });

  it('sets a daily ceiling, and refuses one that isn’t a whole number of calls', async () => {
    const { repo, calls } = providersApi();
    const adzuna = await repo.setProviderCeiling('adzuna', 500);
    expect(calls[0]).toMatchObject({ method: 'PATCH', body: { dailyCalls: 500 } });
    expect(adzuna.quota.ceiling).toBe(500);

    await expect(repo.setProviderCeiling('adzuna', -5)).rejects.toMatchObject({
      code: 'invalid_ceiling',
    });
    await expect(repo.setProviderCeiling('adzuna', 1.5)).rejects.toMatchObject({
      code: 'invalid_ceiling',
    });
    expect(main(calls)).toHaveLength(2);
  });

  it('sends a key write-only, trimmed, and keeps nothing but that one is set', async () => {
    const { repo, calls } = providersApi();
    const result = await repo.setProviderKey('jsearch', '  rk_live_12345678  ');

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'PUT http://api.test/api/v1/admin/providers/jsearch/key',
    ]);
    expect(calls[0]!.body).toEqual({ key: 'rk_live_12345678' });
    expect(result).toEqual({ provider: 'jsearch', keySet: true });

    await expect(repo.setProviderKey('jsearch', ' short ')).rejects.toMatchObject({
      code: 'invalid_key',
    });
    expect(calls).toHaveLength(1);
  });

  it('reads today’s traffic, errors, key and pause from /admin/providers/stats', async () => {
    // `business.providerStats`: only providers with calls this week or an audit row.
    const { repo } = fakeApi({
      'GET /admin/providers': { body: { data: seedProviders() } },
      'GET /admin/providers/stats': {
        body: {
          fixture: {
            callsToday: 200,
            errorRate: 0.05,
            errorTrend: [0.01, 0.05],
            keyAddedAt: null,
            keyAddedBy: null,
            pausedBy: null,
          },
          adzuna: {
            callsToday: 0,
            errorRate: null,
            errorTrend: [],
            keyAddedAt: '2026-10-12T09:00:00.000Z',
            keyAddedBy: 'Ehsan',
            pausedBy: { name: 'Ehsan', at: '2026-11-01T09:00:00.000Z' },
          },
        },
      },
    });
    const [fixture, adzuna, jsearch] = await repo.providers();
    expect(fixture).toMatchObject({
      health: 'degraded',
      errorRate: 0.05,
      errorTrend: [0.01, 0.05],
      quota: { used: 200, ceiling: null },
    });
    expect(adzuna).toMatchObject({
      health: 'paused',
      key: { set: true, addedAt: '2026-10-12T09:00:00.000Z', addedBy: 'Ehsan' },
      pausedBy: { name: 'Ehsan', at: '2026-11-01T09:00:00.000Z' },
    });
    // Not in the stats: no calls this week, so none today and no rate.
    expect(jsearch).toMatchObject({ quota: { used: 0 }, errorRate: null, pausedBy: null });
  });

  it('a provider the server doesn’t know is refused as not found', async () => {
    const { repo } = providersApi();
    await expect(repo.setProviderEnabled('jooble', true)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
