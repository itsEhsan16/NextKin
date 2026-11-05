import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adminActivityFixture, adminOverviewFixture, adminQueuesFixture } from '../src/mock';
import { adminAuditFixture } from '../src/mock/fixtures/adminTrust';
import { useMockModeStore } from '../src/mock/mode';
import { ADMIN_GENERATION_KINDS } from '../src/models/admin';
import { createMockRepos } from '../src/repos';
import { resetAdminMocks } from '../src/repos/adminMockReset';
import { matchesActivity } from '../src/repos/adminRepo';
import { toOverview } from '../src/repos/http/adminOverviewWire';

/** The admin Overview's data (Figma 394:536). Synthetic figures only. */

describe('the Overview fixture', () => {
  it('holds the board’s thirty-day totals', () => {
    const { generations } = adminOverviewFixture('30d');
    const runs = ADMIN_GENERATION_KINDS.reduce((sum, k) => sum + generations!.totals[k].runs, 0);
    const failed = ADMIN_GENERATION_KINDS.reduce(
      (sum, k) => sum + generations!.totals[k].failed,
      0,
    );
    expect(runs).toBe(18_904);
    expect(failed).toBe(461);
    expect(adminQueuesFixture.reduce((sum, q) => sum + q.count, 0)).toBe(30);
  });

  it('scales counts with the window but leaves rates alone', () => {
    const week = adminOverviewFixture('7d');
    const month = adminOverviewFixture('30d');
    expect(week.kpis[0]!.value).toBeLessThan(month.kpis[0]!.value);
    expect(week.kpis[1]!.value).toBe(month.kpis[1]!.value);
  });

  it('totals seven days from the chart’s last seven bars', () => {
    const { generations } = adminOverviewFixture('7d');
    const week = generations!.days.slice(-7);
    for (const kind of ADMIN_GENERATION_KINDS) {
      expect(generations!.totals[kind].runs).toBe(week.reduce((sum, d) => sum + d.runs[kind], 0));
    }
    const failed = ADMIN_GENERATION_KINDS.reduce((s, k) => s + generations!.totals[k].failed, 0);
    expect(failed).toBe(week.reduce((sum, d) => sum + d.failed, 0));
  });

  it('times its activity rows as the Audit log times the same events', () => {
    expect(adminActivityFixture.map((row) => row.at)).toEqual(
      adminAuditFixture.slice(0, 5).map((event) => event.at),
    );
  });
});

describe('the mock admin repository', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 50 });
    useMockModeStore.setState({ mode: 'normal' });
    resetAdminMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
    useMockModeStore.setState({ mode: 'normal' });
  });

  it('counts the queues from the other areas, so clearing a KB diff moves them', async () => {
    const repos = createMockRepos();
    const before = await repos.admin.queues();
    expect(before.map((q) => [q.key, q.count])).toEqual(
      adminQueuesFixture.map((q) => [q.key, q.count]),
    );
    expect(before.map((q) => q.detail)).toEqual(adminQueuesFixture.map((q) => q.detail));

    const [first] = await repos.adminContent.kbQueue();
    await repos.adminContent.decideChange(first!.id, 'reject');
    const after = await repos.admin.queues();
    expect(after.find((q) => q.key === 'kbReview')!.count).toBe(13);
  });

  it('empties every aggregate in empty mode, leaving nothing a card would contradict', async () => {
    useMockModeStore.setState({ mode: 'empty' });
    const overview = await createMockRepos().admin.overview('30d');
    expect(overview.kpis).toEqual([
      expect.objectContaining({ key: 'signups', value: 0, delta: null }),
    ]);
    expect(overview.unmeasured).toEqual(['activation', 'reliability', 'conversion']);
    expect(overview.generations).toMatchObject({ delta: null, p95Seconds: null, days: [] });
    expect(overview.pipeline).toMatchObject({ p95Seconds: null, slaMetRate: null });
    expect(overview.aiCost!.stages).toEqual([]);
    expect(overview.subscriptions).toMatchObject({ activePro: 0, revenue: [], delta: null });
    expect(overview.ats!.mean).toBeNull();
  });
});

describe('searching the audit rows', () => {
  it('matches action, staff, role, reason and target, ignoring case', () => {
    const hits = (query: string) =>
      adminActivityFixture.filter((row) => matchesActivity(row, query)).map((row) => row.id);
    expect(hits('')).toHaveLength(adminActivityFixture.length);
    expect(hits('CURATOR')).toEqual(['aud_3']);
    expect(hits('priya')).toEqual(['aud_5', 'aud_2']);
    expect(hits('4f2a')).toEqual(['aud_5']);
    expect(hits('ticket 2231')).toEqual(['aud_2']);
  });
});

describe('the Overview from /admin/overview', () => {
  const rate = (key: string, value: number) => ({
    key,
    value,
    delta: 1.2,
    target: 0.55,
    trend: [0.5, value],
    basis: { cohort: 10, hit: Math.round(value * 10) },
  });
  const wire = {
    range: '7d',
    signups: { value: 14, delta: 16.7, trend: [1, 2, 3, 0, 4, 2, 2] },
    activation: rate('activation', 0.6),
    reliability: rate('reliability', 0.9),
    conversion: null,
    generations: {
      kinds: [
        { kind: 'resume', runs: 40, failed: 2 },
        { kind: 'tailor', runs: 9, failed: 0 },
        { kind: 'ats_check', runs: 1, failed: 1 },
      ],
      delta: -5,
      p95Seconds: 52,
      days: [{ date: '2026-11-05T00:00:00.000Z', runs: { resume: 3, tailor: 1 }, failed: 1 }],
    },
    pipeline: {
      status: 'healthy',
      queueDepth: 0,
      oldestQueuedSeconds: null,
      queueState: 'normal',
      p95Seconds: 60,
      p95TargetSeconds: 180,
      slaMetRate: 1,
      slaTargetRate: 0.99,
    },
    aiCost: {
      totalUsd: 5.5,
      delta: null,
      stages: [
        { key: 'resume_generate', usd: 4 },
        { key: 'tailor_rewrite', usd: 1.5 },
      ],
      costPerResumeUsd: 0.1,
    },
    subscriptions: {
      activePro: 3,
      delta: null,
      newThisMonth: 1,
      revenue: [
        { currency: 'USD', amountMinor: 3800, usdMinor: 3800, subscribers: 2 },
        { currency: 'EUR', amountMinor: 1900, usdMinor: null, subscribers: 1 },
      ],
      monthlyShare: 2 / 3,
    },
    ats: { mean: 71.4, delta: 2.1, rubricVersion: 'v2', buckets: [] },
    providers: [{ provider: 'adzuna', enabled: true, calls: 0, share: 0, errorRate: null }],
  };

  it('maps every served figure, and says which rates had nothing to measure', () => {
    const overview = toOverview(wire, '7d');
    expect(overview.kpis.map((kpi) => [kpi.key, kpi.value, kpi.delta])).toEqual([
      ['signups', 14, { value: 16.7, unit: 'percent' }],
      ['activation', 0.6, { value: 1.2, unit: 'points' }],
      ['reliability', 0.9, { value: 1.2, unit: 'points' }],
    ]);
    expect(overview.kpis[1]!.measured).toEqual({ cohort: 10, hit: 6 });
    expect(overview.unmeasured).toEqual(['conversion']);
    expect(overview.generations!.totals.resume).toEqual({ runs: 40, failed: 2 });
    expect(overview.generations!.totals.tailor).toEqual({ runs: 9, failed: 0 });
    expect(overview.generations!.days[0]!.runs).toEqual({
      resume: 3,
      tailor: 1,
      cover_letter: 0,
      ats_check: 0,
      interview: 0,
    });
    expect(overview.aiCost!.stages.map((stage) => stage.label)).toEqual([
      'Write resume',
      'Tailor rewrite',
    ]);
    // No exchange rate is held: EUR keeps its amount and has no USD value.
    expect(overview.subscriptions!.revenue![1]).toEqual({
      currency: 'EUR',
      amountMinor: 1900,
      usdMinor: null,
      subscribers: 1,
    });
    expect(overview.ats!.delta).toEqual({ value: 2.1, unit: 'points' });
    expect(overview.providers).toEqual([
      { provider: 'adzuna', label: 'Adzuna', enabled: true, share: 0, errorRate: null },
    ]);
  });
});
