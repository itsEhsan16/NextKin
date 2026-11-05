import type {
  AdminAnalyticsPage,
  AdminJobProvider,
  AdminPlan,
  AnalyticsRange,
  CohortCell,
  CompGrant,
  PriceVersion,
} from '../../models/adminBusiness';

/**
 * The Business boards' records (Figma 406:2873 Plans & pricing, 407:1430 Analytics, 408:3596 Job
 * providers), as drawn: the page can be checked against the board. Dates are the board's own.
 * The second page of comped access (two rows) is invented, since the board says "Page 1 of 2".
 */

const ehsan = { name: 'Ehsan', role: 'super_admin' } as const;
const ana = { name: 'Ana L.', role: 'admin' } as const;

const usd = (dollars: number, eur: number, aud: number) => ({
  USD: Math.round(dollars * 100),
  EUR: Math.round(eur * 100),
  AUD: Math.round(aud * 100),
});

const PAID_QUOTAS = [
  { key: 'generation', label: 'Generations per month', limit: 100, per: 'month' as const },
  { key: 'cover_letter', label: 'Cover letters per month', limit: 30, per: 'month' as const },
  { key: 'ats_check', label: 'ATS checks per month', limit: 100, per: 'month' as const },
  { key: 'interview_set', label: 'Interview question sets', limit: 10, per: 'month' as const },
  {
    key: 'zero_resume',
    label: 'Zero Resume',
    limit: null,
    per: 'month' as const,
    note: 'Counts as a generation',
  },
];

export const adminPlansFixture: AdminPlan[] = [
  {
    id: 'free',
    tier: 'free',
    name: 'Free',
    period: 'month',
    prices: usd(0, 0, 0),
    active: 47_800,
    activeDelta: 2_236,
    quotas: [
      { key: 'generation', label: 'Generations per month', limit: 10, per: 'month' },
      { key: 'cover_letter', label: 'Cover letters per month', limit: 3, per: 'month' },
      { key: 'ats_check', label: 'ATS checks per month', limit: 10, per: 'month' },
      {
        key: 'interview_set_per_resume',
        label: 'Interview question sets',
        limit: 1,
        per: 'resume',
      },
      {
        key: 'zero_resume',
        label: 'Zero Resume',
        limit: null,
        per: 'month',
        note: 'Counts as a generation',
      },
    ],
    quotasChanged: { at: '2026-09-02T10:00:00.000Z', by: 'Ana L.' },
  },
  {
    id: 'pro_monthly',
    tier: 'pro',
    name: 'Pro monthly',
    period: 'month',
    prices: usd(19, 19, 29),
    active: 260,
    activeDelta: 24,
    quotas: PAID_QUOTAS,
    quotasChanged: { at: '2026-10-01T10:00:00.000Z', by: 'Ehsan' },
  },
  {
    id: 'pro_annual',
    tier: 'pro',
    name: 'Pro annual',
    period: 'year',
    prices: usd(109, 109, 165),
    active: 152,
    activeDelta: 14,
    quotas: PAID_QUOTAS,
    quotasChanged: { at: '2026-10-01T10:00:00.000Z', by: 'Ehsan' },
  },
];

export const adminPriceBookFixture: PriceVersion[] = [
  {
    version: 3,
    effectiveFrom: '2026-10-01',
    monthly: usd(19, 19, 29),
    annual: usd(109, 109, 165),
    createdBy: ehsan,
    status: 'active',
  },
  {
    version: 2,
    effectiveFrom: '2026-06-01',
    monthly: usd(17, 17, 27),
    annual: usd(99, 99, 149),
    createdBy: ana,
    status: 'retired',
  },
  {
    version: 1,
    effectiveFrom: '2026-01-15',
    monthly: usd(15, 15, 24),
    annual: usd(89, 89, 139),
    createdBy: ehsan,
    status: 'retired',
  },
];

export const adminCompsFixture: CompGrant[] = [
  {
    id: 'comp_1',
    userRef: 'usr_8d1c4f2a',
    months: 12,
    reason: 'Pilot cohort tester, spring 2026',
    grantedBy: ehsan,
    startedAt: '2026-10-03',
    endsAt: '2027-10-03',
  },
  {
    id: 'comp_2',
    userRef: 'usr_b45e9c10',
    months: 3,
    reason: 'Goodwill after ticket 2231 (export layout broken)',
    grantedBy: ana,
    startedAt: '2026-10-18',
    endsAt: '2027-01-18',
  },
  {
    id: 'comp_3',
    userRef: 'usr_0f6371be',
    months: 6,
    reason: 'Career coach partner review',
    grantedBy: ana,
    startedAt: '2026-10-02',
    endsAt: '2027-04-02',
  },
  {
    id: 'comp_4',
    userRef: 'usr_37a2e1d0',
    months: 1,
    reason: 'Double charge at checkout, comped while Stripe refund clears',
    grantedBy: ehsan,
    startedAt: '2026-11-05',
    endsAt: '2026-12-05',
  },
  // Page 2 isn't drawn; these two only fill it.
  {
    id: 'comp_5',
    userRef: 'usr_91d4b3c7',
    months: 2,
    reason: 'Beta tester for interview prep',
    grantedBy: ehsan,
    startedAt: '2026-09-20',
    endsAt: '2026-11-20',
  },
  {
    id: 'comp_6',
    userRef: 'usr_6e2f58ad',
    months: 12,
    reason: 'Accessibility review partner',
    grantedBy: ana,
    startedAt: '2026-08-14',
    endsAt: '2027-08-14',
  },
];

// --- Analytics ------------------------------------------------------------------------------

const measured = (rates: number[], weeks = 7): CohortCell[] =>
  Array.from({ length: weeks }, (_, week) =>
    week < rates.length ? { rate: rates[week]! / 100 } : { state: 'future' as const },
  );

const COHORTS = [
  { label: 'Sep 7', users: 584, weeks: measured([100, 63, 51, 45, 42, 39, 37]) },
  { label: 'Sep 14', users: 562, weeks: measured([100, 61, 50, 44, 40, 38, 36]) },
  { label: 'Sep 21', users: 601, weeks: measured([100, 64, 53, 46, 43, 40]) },
  { label: 'Sep 28', users: 547, weeks: measured([100, 60, 49, 43, 40, 38]) },
  { label: 'Oct 5', users: 612, weeks: measured([100, 62, 52, 45, 41]) },
  { label: 'Oct 12', users: 590, weeks: measured([100, 65, 54, 47]) },
  { label: 'Oct 19', users: 571, weeks: measured([100, 63, 51]) },
  { label: 'Oct 26', users: 604, weeks: measured([100, 61]) },
];

/**
 * The ATS buckets: the board's text is exact (6,212 checks, 15% below 60, most common 70–79); the
 * counts behind its bars are read off their heights and fitted to those figures.
 */
const ATS_BUCKETS = [28, 49, 83, 132, 236, 404, 1292, 1699, 1488, 801];

const SCALE: Record<AnalyticsRange, number> = { '7d': 7 / 30, '30d': 1, '90d': 3 };

export function adminAnalyticsFixture(range: AnalyticsRange): AdminAnalyticsPage {
  const n = (count: number) => Math.round(count * SCALE[range]);
  return {
    range,
    funnel: {
      conversion: 0.034,
      deltaPoints: 0.3,
      steps: [
        { key: 'signed_up', label: 'Signed up', count: n(2418) },
        { key: 'verified_email', label: 'Verified email', count: n(2104) },
        { key: 'first_resume', label: 'First resume within 72 h', count: n(1407) },
        { key: 'tailored', label: 'Tailored to a job', count: n(962) },
        { key: 'started_pro', label: 'Started Pro', count: n(82) },
      ],
    },
    retention: { cohorts: COHORTS, week4Average: 0.41 },
    generations: {
      rows: [
        { kind: 'tailor', label: 'Tailor', count: n(6210) },
        { kind: 'resume', label: 'Resume', count: n(5480) },
        { kind: 'cover_letter', label: 'Cover letter', count: n(3120) },
        { kind: 'ats_check', label: 'ATS check', count: n(2860) },
        { kind: 'interview', label: 'Interview', count: n(1234) },
      ],
      total: n(18_904),
      perActiveUser: 0.86,
      failed: n(461),
      failedRate: 0.024,
      p95Seconds: 41,
    },
    ats: {
      mean: 71.4,
      deltaPoints: 2.1,
      median: 73,
      rubricVersion: 'v3',
      buckets: ATS_BUCKETS.map((count, index) => ({
        from: index * 10,
        to: index * 10 + 10,
        count: n(count),
      })),
    },
    quota: {
      planLabel: 'Free plan',
      atCapShare: 0.186,
      deltaPoints: 1.4,
      rows: [
        { key: 'generation', label: 'Generations', cap: 'cap 10 a month', atCapShare: 0.142 },
        { key: 'ats_check', label: 'ATS checks', cap: 'cap 10 a month', atCapShare: 0.098 },
        { key: 'cover_letter', label: 'Cover letters', cap: 'cap 3 a month', atCapShare: 0.061 },
        {
          key: 'interview_set',
          label: 'Interview sets',
          cap: 'cap 1 per resume',
          atCapShare: 0.034,
        },
      ],
    },
    providerUsage: {
      rows: [
        row('tailor.rewrite', n(6210), 41.2e6 * SCALE[range], 526.4 * SCALE[range], 0.62, 0.004),
        row('ai.review', n(5980), 18.4e6 * SCALE[range], 270.1 * SCALE[range], 0.71, 0.003),
        row('jd.structure', n(4412), 11.9e6 * SCALE[range], 231.3 * SCALE[range], 0.48, 0.012),
        row('resume.parse', n(3860), 8.7e6 * SCALE[range], 153.8 * SCALE[range], 0.34, 0.008),
        row('interview.prep', n(1234), 5.1e6 * SCALE[range], 102.6 * SCALE[range], 0.55, 0.006),
      ],
      totalUsd: Math.round(1284.2 * SCALE[range] * 100) / 100,
    },
  };
}

function row(
  tag: string,
  calls: number,
  tokens: number,
  costUsd: number,
  cacheHitRate: number,
  errorRate: number,
) {
  return {
    tag,
    provider: 'Anthropic',
    calls,
    tokens: Math.round(tokens),
    costUsd: Math.round(costUsd * 100) / 100,
    cacheHitRate,
    errorRate,
  };
}

// --- Job providers --------------------------------------------------------------------------

export const adminJobProvidersFixture: AdminJobProvider[] = [
  {
    provider: 'adzuna',
    label: 'Adzuna',
    subtitle: 'Search API · US, UK, AU',
    enabled: true,
    health: 'degraded',
    key: { set: true, addedAt: '2026-10-12', addedBy: 'Ehsan' },
    quota: { used: 6_200, ceiling: 10_000 },
    errorRate: 0.041,
    errorTrend: [0.6, 0.7, 0.6, 0.9, 1.2, 1.8, 2.4, 2.9, 3.4, 3.8, 4.1],
    errorNote: 'Rising since Nov 1 · mostly 429 rate limits',
    attribution: { rule: 'Show “Jobs by Adzuna” logo on results', state: 'shown' },
    pausedBy: null,
  },
  {
    provider: 'jooble',
    label: 'Jooble',
    subtitle: 'REST API · worldwide',
    enabled: true,
    health: 'healthy',
    key: { set: true, addedAt: '2026-09-30', addedBy: 'Ehsan' },
    quota: { used: 3_800, ceiling: 10_000 },
    errorRate: 0.003,
    errorTrend: [0.3, 0.4, 0.3, 0.2, 0.3, 0.4, 0.3, 0.3, 0.2, 0.3, 0.3],
    errorNote: 'Last 7 days · within target',
    attribution: { rule: 'Link each result back to its Jooble listing', state: 'shown' },
    pausedBy: null,
  },
  {
    provider: 'usajobs',
    label: 'USAJobs',
    subtitle: 'Search API · US federal roles',
    enabled: true,
    health: 'healthy',
    key: { set: true, addedAt: '2026-08-21', addedBy: 'Ehsan' },
    quota: { used: 1_200, ceiling: 10_000 },
    errorRate: 0,
    errorTrend: [0.1, 0, 0, 0.1, 0, 0, 0, 0.1, 0, 0, 0],
    errorNote: 'Last 7 days · within target',
    attribution: { rule: 'Credit USAJOBS.gov as the source on results', state: 'shown' },
    pausedBy: null,
  },
  {
    provider: 'remotive',
    label: 'Remotive',
    subtitle: 'Remote roles',
    enabled: false,
    health: 'paused',
    key: { set: true, addedAt: '2026-10-02', addedBy: 'Ehsan' },
    quota: { used: 0, ceiling: 2_000 },
    errorRate: null,
    errorTrend: [0.4, 0.6, 0.9, 0.7, 0.5, 0.4, 0.3, 0.3, 0.2, 0.2, 0.2],
    errorNote: 'No traffic while paused',
    attribution: { rule: 'Link to the original Remotive listing', state: 'enforced_when_enabled' },
    pausedBy: { name: 'Ana L.', at: '2026-10-30' },
  },
];
