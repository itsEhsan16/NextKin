import type {
  AdminActivity,
  AdminKpi,
  AdminMe,
  AdminOverview,
  AdminQueue,
  AdminRange,
  GenerationDay,
  AdminGenerationKind,
} from '../../models/admin';

import { adminAuditFixture } from './adminTrust';
import { daysAgo } from './time';

/**
 * The admin Overview, Direction A "Light ops" (Figma 394:536). The board's sample figures, as the
 * board says of them, "only show the format": every value below is the board's own, so the page
 * can be checked against it. The chart's daily runs are read off the board's bar heights at the
 * gridlines' scale (800 runs to 256px, 395:629–395:637); Sat Nov 1 is the hovered bar, whose
 * tooltip states its figures exactly.
 */

export const adminMeFixture: AdminMe = {
  userId: 'usr_staff_ehsan',
  name: 'Ehsan',
  email: 'ehsan@nextkin.ai',
  role: 'super_admin',
  permissions: [
    'users.read',
    'users.manage',
    'users.content',
    'roles.assign',
    'audit.read',
    'content.manage',
    'plans.manage',
    'providers.manage',
    'providers.keys',
    'analytics.read',
  ],
};

const day = (ago: number, runs: number[], failed: number): GenerationDay => {
  const [resume = 0, tailor = 0, coverLetter = 0, atsCheck = 0, interview = 0] = runs;
  return {
    date: daysAgo(ago),
    runs: { resume, tailor, cover_letter: coverLetter, ats_check: atsCheck, interview },
    failed,
  };
};

/** The last fourteen days, oldest first; four days ago is the board's Sat Nov 1. */
const DAYS: GenerationDay[] = [
  day(13, [178, 156, 72, 72, 41], 12),
  day(12, [206, 184, 84, 84, 50], 14),
  day(11, [197, 175, 81, 81, 47], 14),
  day(10, [153, 134, 62, 62, 38], 10),
  day(9, [144, 125, 59, 59, 34], 10),
  day(8, [219, 191, 91, 91, 50], 15),
  day(7, [234, 206, 97, 97, 56], 16),
  day(6, [241, 212, 100, 100, 56], 17),
  day(5, [225, 197, 94, 94, 53], 15),
  day(4, [276, 244, 114, 114, 65], 9),
  day(3, [191, 169, 78, 78, 44], 13),
  day(2, [203, 181, 84, 84, 47], 14),
  day(1, [244, 216, 100, 100, 56], 17),
  day(0, [206, 184, 84, 84, 50], 14),
];

/** The board's thirty-day totals: 18,904 runs, 461 of them failed. */
const TOTALS_30D: Record<AdminGenerationKind, { runs: number; failed: number }> = {
  resume: { runs: 6427, failed: 156 },
  tailor: { runs: 5671, failed: 139 },
  cover_letter: { runs: 2647, failed: 64 },
  ats_check: { runs: 2647, failed: 65 },
  interview: { runs: 1512, failed: 37 },
};

/** The four sparklines, read off the board's paths (oldest first). */
const TRENDS = {
  signups: [3, 8.8, 5.9, 14.6, 11.7, 20.5, 17.5, 23.4, 20.5, 29.2, 26.3, 35],
  activation: [2.5, 9.6, 6.1, 16.7, 13.2, 23.8, 20.3, 27.4, 30.9, 27.4, 34.5, 34.5],
  reliability: [32.4, 27.5, 34.9, 22.6, 20.1, 15.2, 25.1, 10.3, 5.4, 12.7, 2.9, 7.8],
  conversion: [2.4, 6.4, 14.4, 10.4, 18.4, 22.4, 18.4, 26.4, 30.4, 26.4, 34.4, 34.4],
};

/** How much of the thirty-day board a shorter or longer window holds: counts scale, rates don't. */
const SCALE: Record<AdminRange, number> = { '7d': 7 / 30, '30d': 1, '90d': 3 };

const scaled = (n: number, range: AdminRange) => Math.round(n * SCALE[range]);

/**
 * The window's runs by kind. Seven days are the chart's last seven bars added up, so the total
 * and the bars agree; the failures split by kind at each kind's thirty-day failure rate, the
 * remainder on the largest kind. Thirty days are the board's totals; ninety scale them.
 */
function totalsFor(
  range: AdminRange,
): Record<AdminGenerationKind, { runs: number; failed: number }> {
  const entries = Object.entries(TOTALS_30D) as [
    AdminGenerationKind,
    { runs: number; failed: number },
  ][];
  if (range !== '7d') {
    return Object.fromEntries(
      entries.map(([kind, total]) => [
        kind,
        { runs: scaled(total.runs, range), failed: scaled(total.failed, range) },
      ]),
    ) as Record<AdminGenerationKind, { runs: number; failed: number }>;
  }
  const week = DAYS.slice(-7);
  const failed = week.reduce((sum, d) => sum + d.failed, 0);
  const totals = Object.fromEntries(
    entries.map(([kind, total]) => {
      const runs = week.reduce((sum, d) => sum + d.runs[kind], 0);
      return [kind, { runs, failed: Math.round((runs * total.failed) / total.runs) }];
    }),
  ) as Record<AdminGenerationKind, { runs: number; failed: number }>;
  const split = entries.reduce((sum, [kind]) => sum + totals[kind].failed, 0);
  totals.resume.failed += failed - split;
  return totals;
}

function kpis(range: AdminRange): AdminKpi[] {
  return [
    {
      key: 'signups',
      value: scaled(2418, range),
      format: 'count',
      delta: { value: 12.4, unit: 'percent' },
      basis: { kind: 'previous' },
      trend: TRENDS.signups,
    },
    {
      key: 'activation',
      value: 0.582,
      format: 'rate',
      delta: { value: 3.2, unit: 'points' },
      basis: { kind: 'target', rate: 0.55 },
      trend: TRENDS.activation,
    },
    {
      key: 'reliability',
      value: 0.976,
      format: 'rate',
      delta: { value: -0.4, unit: 'points' },
      basis: { kind: 'target', rate: 0.98 },
      trend: TRENDS.reliability,
    },
    {
      key: 'conversion',
      value: 0.034,
      format: 'rate',
      delta: { value: 0.3, unit: 'points' },
      basis: { kind: 'target', rate: 0.03 },
      trend: TRENDS.conversion,
    },
  ];
}

export function adminOverviewFixture(range: AdminRange): AdminOverview {
  const totals = totalsFor(range);

  return {
    range,
    kpis: kpis(range),
    generations: { totals, delta: { value: 9.1, unit: 'percent' }, p95Seconds: 41, days: DAYS },
    pipeline: {
      status: 'healthy',
      queueDepth: 12,
      queueState: 'normal',
      p95Seconds: 41,
      p95TargetSeconds: 60,
      slaMetRate: 0.992,
      slaTargetRate: 0.99,
    },
    aiCost: {
      totalUsd: scaled(1284, range),
      delta: { value: 6.2, unit: 'percent' },
      stages: [
        { key: 'tailor_rewrite', label: 'Tailor rewrite', usd: scaled(526, range) },
        { key: 'ai_review', label: 'AI review', usd: scaled(270, range) },
        { key: 'structure_jd', label: 'Structure JD', usd: scaled(231, range) },
        { key: 'parse_resume', label: 'Parse resume', usd: scaled(154, range) },
        { key: 'interview_prep', label: 'Interview prep', usd: scaled(103, range) },
      ],
      costPerResumeUsd: 0.061,
    },
    subscriptions: {
      activePro: 412,
      delta: { value: 10.2, unit: 'percent' },
      newThisMonth: 38,
      // The board's centre figure ($7,260) is the three amounts added 1:1; no exchange rate is
      // applied yet, so the USD equivalent here repeats each amount (`toreview.md` §171). The
      // subscribers per currency add up to the 412 active Pro; the board doesn't print them.
      revenue: [
        { currency: 'USD', amountMinor: 498_000, usdMinor: 498_000, subscribers: 282 },
        { currency: 'EUR', amountMinor: 132_000, usdMinor: 132_000, subscribers: 75 },
        { currency: 'AUD', amountMinor: 96_000, usdMinor: 96_000, subscribers: 55 },
      ],
      monthlyShare: 0.63,
    },
    ats: {
      mean: 71.4,
      delta: { value: 2.1, unit: 'points' },
      rubricVersion: 'v3',
      buckets: [30, 62, 110, 190, 350, 640, 1240, 1490, 1020, 360].map((count, index) => ({
        from: index * 10,
        to: index * 10 + 10,
        count: scaled(count, range),
      })),
    },
    providers: [
      { provider: 'adzuna', label: 'Adzuna', enabled: true, share: 0.62, errorRate: 0.041 },
      { provider: 'jooble', label: 'Jooble', enabled: true, share: 0.38, errorRate: 0.003 },
      { provider: 'usajobs', label: 'USAJobs', enabled: true, share: 0.12, errorRate: 0 },
      { provider: 'remotive', label: 'Remotive', enabled: false, share: 0, errorRate: 0 },
    ],
  };
}

/** The six queues in the board's order, which the sidebar's counts repeat. */
export const adminQueuesFixture: AdminQueue[] = [
  { key: 'generationFailures', count: 7, detail: 'Oldest 2h ago · retries used up' },
  { key: 'kbReview', count: 14, detail: 'Diffs waiting for approve or reject' },
  { key: 'deletionRequests', count: 3, detail: '1 due in 4 days (30-day limit)' },
  { key: 'abuseReports', count: 2, detail: 'Reported resumes and misuse' },
  { key: 'promptDrafts', count: 2, detail: 'Need a passing eval to publish' },
  { key: 'providerErrors', count: 2, detail: 'Adzuna at 4.1% errors today' },
];

/**
 * The board's five audit rows, newest first, at the times it prints. They are the Audit log's
 * five newest events (408:1759), so each takes that event's instant, and the two pages agree on
 * when it happened; the Overview's own wording for each action is kept.
 */
const at = (index: number): string => adminAuditFixture[index]!.at;

export const adminActivityFixture: AdminActivity[] = [
  {
    id: 'aud_5',
    staff: { name: 'Priya R.', role: 'support' },
    action: 'Sent a password reset',
    target: { kind: 'user', ref: 'usr_8d1c4f2a' },
    reason: 'user_request',
    result: 'done',
    at: at(0),
  },
  {
    id: 'aud_4',
    staff: { name: 'Ehsan', role: 'super_admin' },
    action: 'Published prompt tailor.rewrite v14',
    target: { kind: 'prompt', ref: 'v14' },
    reason: 'Eval passed · 0.91',
    result: 'done',
    at: at(1),
  },
  {
    id: 'aud_3',
    staff: { name: 'Marco K.', role: 'curator' },
    action: 'Approved KB change: Next.js 15 release date',
    target: { kind: 'technology', ref: 'tech_37a2e1d0' },
    reason: 'Source cited',
    result: 'done',
    at: at(2),
  },
  {
    id: 'aud_2',
    staff: { name: 'Priya R.', role: 'support' },
    action: 'Opened resume content',
    target: { kind: 'user', ref: 'usr_b45e9c10' },
    reason: 'Ticket 2231: export layout broken',
    result: 'audited_read',
    at: at(3),
  },
  {
    id: 'aud_1',
    staff: { name: 'Ehsan', role: 'super_admin' },
    action: 'Suspended an account',
    target: { kind: 'user', ref: 'usr_0f6371be' },
    reason: 'abuse',
    result: 'suspended',
    at: at(4),
  },
];
