/** NextKin V2 spec §10 — User & Subscription aggregates (candidate app). */

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  /** ISO-8601 */
  createdAt: string;
};

export type SubscriptionPlan = 'free' | 'pro';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

/** Plan row / usage meter copy ("NextKin Free", Figma 1:2232). */
export const SUBSCRIPTION_PLAN_LABEL: Record<SubscriptionPlan, string> = {
  free: 'NextKin Free',
  pro: 'NextKin Pro',
};

export type SubscriptionUsage = {
  generationsUsed: number;
  generationsLimit: number;
  coverLettersUsed: number;
  coverLettersLimit: number;
  /** "2 of 2 free resumes used" (Figma 1:1388) / "2 of 2 resumes" (1:2233). */
  resumesUsed: number;
  resumesLimit: number;
  /** "5 AI credits left" (Figma 1:2233). */
  aiCreditsLeft: number;
  // The V2 §13.3 meters that have no artboard yet; optional so `subscriptionFixture` stays the
  // only construction site and existing call sites keep type-checking.
  /** V2 §13.3 — the standalone ATS resume check (§4.1): upload a resume, JD optional. */
  atsChecksUsed?: number;
  atsChecksLimit?: number;
  /** V2 §13.3 — assistant messages per billing period. */
  assistantMessagesUsed?: number;
  assistantMessagesLimit?: number;
  /** V2 §13.3 — generated interview question sets. */
  interviewSetsUsed?: number;
  interviewSetsLimit?: number;
};

export type Subscription = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  /** ISO-8601; absent on the free plan. */
  renewsAt?: string;
  usage: SubscriptionUsage;
};

/** V2 §7.2 dashboard usage statistics (the Home shortcut grid counters). */
export type DashboardStats = {
  resumesCount: number;
  activitiesCount: number;
  savedJobsCount: number;
};

/**
 * V2 §8.5 — the self-service account data export. The archive is built server-side and handed
 * back as a time-limited download, so the state is a small machine the settings row polls.
 */
export type DataExportState = 'idle' | 'preparing' | 'ready' | 'failed';

export type DataExportStatus = {
  status: DataExportState;
  /** ISO-8601; set once the export has been asked for. */
  requestedAt?: string;
  /** ISO-8601; set when the archive finished building. */
  readyAt?: string;
  /** What the download is called, e.g. "nextkin-export.zip". */
  fileName?: string;
  /** Human-readable size for the row caption ("4.2 MB") — never a raw byte count. */
  sizeLabel?: string;
  /** ISO-8601; the link stops working after this. */
  expiresAt?: string;
  /** Plain failure reason, shown verbatim when `status` is 'failed'. */
  error?: string;
};
