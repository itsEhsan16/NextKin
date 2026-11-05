/**
 * The admin portal (V2 §7.17, ImBackendImplementationPlan P12; Figma "🛠 Admin" page 382:936).
 *
 * Staff see aggregates only on the Overview ("aggregate only, no PII"): a user appears as a masked
 * id, and only staff are named, in the audit rows. Every figure here is a count, a rate or a sum.
 */

/** The four staff roles (`packages/server/src/services/admin/permissions.ts`). */
export type AdminRole = 'support' | 'curator' | 'admin' | 'super_admin';

/** What a role may do; the server's matrix, mirrored so the sidebar can hide what a role can't open. */
export type AdminPermission =
  | 'users.read'
  | 'users.manage'
  | 'users.content'
  | 'roles.assign'
  | 'audit.read'
  | 'content.manage'
  | 'plans.manage'
  | 'providers.manage'
  | 'providers.keys'
  | 'analytics.read';

/**
 * The role → permission matrix, as `services/admin/permissions.ts` defines it on the server. The
 * server decides on every request; this copy only keeps the sidebar from offering a page the role
 * would be refused. A curator sees no People and no Audit log.
 */
export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  support: ['users.read', 'audit.read', 'analytics.read'],
  curator: ['content.manage', 'analytics.read'],
  admin: [
    'users.read',
    'users.manage',
    'users.content',
    'audit.read',
    'content.manage',
    'plans.manage',
    'providers.manage',
    'analytics.read',
  ],
  super_admin: [
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

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  support: 'Support',
  curator: 'Curator',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

/** The signed-in staff member. */
export type AdminMe = {
  userId: string;
  name: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
};

export type AdminRange = '7d' | '30d' | '90d';

export const ADMIN_RANGE_LABEL: Record<AdminRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

/** A change against the previous window: a relative percentage, or percentage points of a rate. */
export type AdminDelta = { value: number; unit: 'percent' | 'points' };

export type AdminKpiKey = 'signups' | 'activation' | 'reliability' | 'conversion';

/**
 * One of the four headline cards. A rate is a fraction (0.582), not a percentage. A card the
 * source doesn't serve is left out of `AdminOverview.kpis`, and the screen says so in its place.
 */
export type AdminKpi = {
  key: AdminKpiKey;
  value: number;
  format: 'count' | 'rate';
  /** `null` where no previous window is served, or the previous window had nothing to compare. */
  delta: AdminDelta | null;
  /** What the delta is read against: the previous window, or a target rate. */
  basis: { kind: 'previous' } | { kind: 'target'; rate: number };
  /** The window's daily values, oldest first, for the sparkline. Empty when none is served. */
  trend: number[];
  /** A rate's count behind it: `hit` of `cohort` (G16). Absent for a count, or where not served. */
  measured?: { cohort: number; hit: number };
};

export type AdminGenerationKind = 'resume' | 'tailor' | 'cover_letter' | 'ats_check' | 'interview';

export const ADMIN_GENERATION_KINDS: readonly AdminGenerationKind[] = [
  'resume',
  'tailor',
  'cover_letter',
  'ats_check',
  'interview',
];

export const ADMIN_GENERATION_KIND_LABEL: Record<AdminGenerationKind, string> = {
  resume: 'Resume',
  tailor: 'Tailor',
  cover_letter: 'Cover letter',
  ats_check: 'ATS check',
  interview: 'Interview',
};

/** One day's AI runs, by kind, and how many of them failed. */
export type GenerationDay = {
  /** ISO date-time at the start of the day. */
  date: string;
  runs: Record<AdminGenerationKind, number>;
  failed: number;
};

export type AdminGenerations = {
  /** Every run in the window, and how many failed, per kind. */
  totals: Record<AdminGenerationKind, { runs: number; failed: number }>;
  /** `null` where the source serves no previous window or run times. */
  delta: AdminDelta | null;
  p95Seconds: number | null;
  /** The most recent days, oldest first: what the chart draws. Empty when no series is served. */
  days: GenerationDay[];
};

/** The work queues staff clear, as the Overview's "Needs attention" and the sidebar's counts. */
export type AdminQueueKey =
  | 'generationFailures'
  | 'kbReview'
  | 'deletionRequests'
  | 'abuseReports'
  | 'promptDrafts'
  | 'providerErrors';

/**
 * One work queue and what is open in it. A queue the source doesn't serve, or the role may not
 * read, is left out of the list (not sent as a zero), so a missing queue never reads as "all clear".
 */
export type AdminQueue = {
  key: AdminQueueKey;
  count: number;
  /** One line on the oldest or worst item, e.g. "Oldest 2h ago · retries used up". */
  detail: string;
};

export type AdminPipeline = {
  status: 'healthy' | 'degraded';
  queueDepth: number;
  queueState: 'normal' | 'backlogged';
  /** `null` when no run finished in the window: there is nothing to time. */
  p95Seconds: number | null;
  p95TargetSeconds: number;
  /** The share of runs that finished inside the 3-minute SLA; `null` with no runs in the window. */
  slaMetRate: number | null;
  /** The share the SLA promises, which `slaMetRate` is judged against (0.99). */
  slaTargetRate: number;
};

export type AdminAiCost = {
  totalUsd: number;
  delta: AdminDelta | null;
  /** Spend by pipeline stage, largest first. */
  stages: { key: string; label: string; usd: number }[];
  costPerResumeUsd: number | null;
};

export type AdminSubscriptions = {
  activePro: number;
  delta: AdminDelta | null;
  newThisMonth: number | null;
  /**
   * Monthly recurring revenue per currency, in minor units, net of tax, and how many subscribers
   * pay in it. `usdMinor` is its USD value, `null` where no exchange rate is held (only USD has
   * one on the server). `null` where the source doesn't serve revenue; empty when no one pays.
   */
  revenue:
    | {
        currency: 'USD' | 'EUR' | 'AUD';
        amountMinor: number;
        usdMinor: number | null;
        subscribers: number;
      }[]
    | null;
  /** The share of Pro subscriptions billed monthly; the rest are annual. */
  monthlyShare: number | null;
};

export type AdminAtsDistribution = {
  /** The mean of the scores themselves, which the buckets alone can't give. */
  mean: number | null;
  delta: AdminDelta | null;
  rubricVersion: string | null;
  /** Ten-point buckets from 0 to 100, lowest first. */
  buckets: { from: number; to: number; count: number }[];
};

export type AdminProvider = {
  provider: string;
  label: string;
  enabled: boolean;
  /** The share of today's job lookups this provider served. */
  share: number;
  /** Today's failed calls over its calls; `null` with no calls today (nothing to measure). */
  errorRate: number | null;
};

/**
 * Everything the Overview draws for one window. A panel is `null` when the data source doesn't
 * serve it yet: the backend has no pipeline or provider-error metrics, for one (`toreview.md`
 * §171). The screen says so in that card rather than drawing a number nobody measured.
 */
export type AdminOverview = {
  range: AdminRange;
  kpis: AdminKpi[];
  /**
   * Headline rates with nothing to measure in the window: activation with no signups, reliability
   * with no runs. Their cards say so rather than print 0%. Absent means none.
   */
  unmeasured?: AdminKpiKey[];
  generations: AdminGenerations | null;
  pipeline: AdminPipeline | null;
  aiCost: AdminAiCost | null;
  subscriptions: AdminSubscriptions | null;
  ats: AdminAtsDistribution | null;
  providers: AdminProvider[] | null;
};

export type AdminActivityResult = 'done' | 'audited_read' | 'suspended' | 'failed';

/** One audit row. The target is masked on screen; only the staff member is named. */
export type AdminActivity = {
  id: string;
  staff: { name: string; role: AdminRole };
  action: string;
  target: { kind: 'user' | 'technology' | 'prompt'; ref: string };
  reason: string;
  result: AdminActivityResult;
  at: string;
};
