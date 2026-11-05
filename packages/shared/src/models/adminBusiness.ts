/**
 * The admin portal's Business area: plans and the price book, product analytics, job providers
 * with write-only keys (Figma 406:2873, 407:1430, 408:3596).
 *
 * Money is in minor units per currency (1900 = $19.00), as the server stores it. Every analytics
 * figure is an aggregate across users; no user is named anywhere here.
 */

export type BusinessCurrency = 'USD' | 'EUR' | 'AUD';
export const BUSINESS_CURRENCIES: readonly BusinessCurrency[] = ['USD', 'EUR', 'AUD'];

/** Minor units per currency. */
export type PriceSet = Record<BusinessCurrency, number>;

/** A staff member as a business record names them: who changed a price or granted access. */
export type BusinessStaffRef = {
  name: string;
  role: 'support' | 'curator' | 'admin' | 'super_admin';
};

/**
 * One quota line on a plan card. `limit` is a count per `per`; `null` is unlimited. A line with a
 * `note` states a rule rather than a count (Zero Resume "Counts as a generation").
 */
export type PlanQuota = {
  key: string;
  label: string;
  limit: number | null;
  per: 'month' | 'resume';
  note?: string;
};

export type AdminPlan = {
  id: string;
  tier: 'free' | 'pro';
  name: string;
  period: 'month' | 'year';
  prices: PriceSet;
  /** Active accounts on the plan, and the change over the last 30 days; `null` where not served. */
  active: number | null;
  activeDelta: number | null;
  quotas: PlanQuota[];
  quotasChanged: { at: string; by: string } | null;
};

/** One row of the price book: the monthly and annual prices that took effect together. */
export type PriceVersion = {
  version: number;
  effectiveFrom: string;
  monthly: PriceSet;
  annual: PriceSet;
  /** `null` for the first version, which came from the seed rather than a staff member. */
  createdBy: BusinessStaffRef | null;
  status: 'active' | 'retired';
};

/** Pro granted free for a while, to a user shown only by a masked id. */
export type CompGrant = {
  id: string;
  userRef: string;
  months: number;
  reason: string;
  /** `null` where the grant's audit row can't be found (a comp made outside the portal). */
  grantedBy: BusinessStaffRef | null;
  startedAt: string;
  endsAt: string;
};

export type CompPage = { rows: CompGrant[]; page: number; pages: number; active: number };

/** What a new price version sets: the Pro monthly and the Pro annual price in every currency. */
export type PriceVersionInput = { monthly: PriceSet; annual: PriceSet };

export type CompInput = { userRef: string; months: number; reason: string };

// --- Analytics ------------------------------------------------------------------------------

export type AnalyticsRange = '7d' | '30d' | '90d';

export type FunnelStep = { key: string; label: string; count: number };

export type AnalyticsFunnel = {
  /** The share of sign-ups who reached the last step. */
  conversion: number;
  deltaPoints: number | null;
  steps: FunnelStep[];
};

/** A heatmap cell: a measured rate, a week that hasn't happened yet, or one not measured. */
export type CohortCell = { rate: number } | { state: 'future' } | { state: 'unmeasured' };

export type RetentionCohort = { label: string; users: number; weeks: CohortCell[] };

export type AnalyticsRetention = { cohorts: RetentionCohort[]; week4Average: number | null };

export type KindUsage = { kind: string; label: string; count: number };

export type AnalyticsGenerations = {
  rows: KindUsage[];
  total: number;
  perActiveUser: number | null;
  failed: number | null;
  failedRate: number | null;
  p95Seconds: number | null;
};

export type AnalyticsAts = {
  mean: number | null;
  deltaPoints: number | null;
  median: number | null;
  rubricVersion: string | null;
  buckets: { from: number; to: number; count: number }[];
};

export type QuotaUse = { key: string; label: string; cap: string; atCapShare: number };

export type AnalyticsQuota = {
  planLabel: string;
  atCapShare: number;
  deltaPoints: number | null;
  rows: QuotaUse[];
};

export type ProviderUsageRow = {
  tag: string;
  provider: string;
  calls: number;
  tokens: number | null;
  costUsd: number;
  cacheHitRate: number | null;
  errorRate: number | null;
};

export type AnalyticsProviderUsage = { rows: ProviderUsageRow[]; totalUsd: number };

/** The Analytics page for one window. A section is `null` where the source doesn't serve it. */
export type AdminAnalyticsPage = {
  range: AnalyticsRange;
  funnel: AnalyticsFunnel | null;
  retention: AnalyticsRetention | null;
  generations: AnalyticsGenerations | null;
  ats: AnalyticsAts | null;
  quota: AnalyticsQuota | null;
  providerUsage: AnalyticsProviderUsage | null;
};

// --- Job providers --------------------------------------------------------------------------

export type ProviderHealth = 'healthy' | 'degraded' | 'paused';

export type AdminJobProvider = {
  provider: string;
  label: string;
  /** "Search API · US, UK, AU". */
  subtitle: string;
  enabled: boolean;
  /** `null` where the source serves no health signal. */
  health: ProviderHealth | null;
  /** Never the key: only whether one is set, and when and by whom. */
  key: { set: boolean; addedAt: string | null; addedBy: string | null };
  /** Calls made today against the daily ceiling; `used` is `null` where not served. */
  quota: { used: number | null; ceiling: number | null };
  errorRate: number | null;
  /** The last week's error rate, oldest first, for the sparkline. */
  errorTrend: number[];
  errorNote: string | null;
  attribution: { rule: string; state: 'shown' | 'enforced_when_enabled' } | null;
  pausedBy: { name: string; at: string } | null;
};
