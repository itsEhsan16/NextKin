/** NextKin V2 spec §10 — User & Subscription aggregates (candidate app). */

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  /**
   * V2 §7.1: an email/password account verifies its address before its first resume download.
   * The web Settings board marks it "Verified" (Figma 254:506). Absent where no screen reads it.
   */
  emailVerified?: boolean;
  /** ISO-8601 */
  createdAt: string;
};

export type SubscriptionPlan = 'free' | 'pro';

/** `paused`: §13.6's 1–3 month pause; `expired`: ended and not renewed (the backend's two extra states). */
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused' | 'expired';

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
  /**
   * V2 §13.3 — assistant messages, capped PER DAY on Free (the other meters are per month). The
   * mock has no clock that rolls this at midnight, so it only ever climbs; the screens say "today"
   * and never name a reset time.
   */
  assistantMessagesUsed?: number;
  assistantMessagesLimit?: number;
  /**
   * V2 §13.3 — "1 question set per generated resume" on Free. `interviewSetsLimit` is that
   * per-resume cap; `interviewSetsUsed` is the running total of sets made and gates nothing —
   * the gate reads the sets that exist for the resume in question (see `interviewAllowance`).
   */
  interviewSetsUsed?: number;
  interviewSetsLimit?: number;
  /**
   * P12-09: when the monthly meters start again (ISO-8601, the first of next month, UTC). §13.5:
   * an exhausted quota shows its reset date. Absent in the mock, which has no clock for it.
   */
  resetsAt?: string;
  /** When today's assistant messages start again (ISO-8601, the next UTC midnight). */
  assistantResetsAt?: string;
};

export type Subscription = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  /** ISO-8601; absent on the free plan. */
  renewsAt?: string;
  usage: SubscriptionUsage;
  /** The SKU behind the tier, when one is bought (P12): which cycle renews. */
  planId?: 'free' | 'pro_monthly' | 'pro_annual';
  /** Cancelled, effective at the end of the paid period (§13.4: self-serve, period-end). */
  cancelAtPeriodEnd?: boolean;
  /** ISO-8601; set while paused (§13.6). */
  pausedUntil?: string;
};

/** What a session runs on, which picks its row's glyph on the web Settings board (254:567). */
export type SessionDevice = 'desktop' | 'phone' | 'tablet';

/**
 * One signed-in browser or app: V2 §7.1 keeps sessions server-side, one record each, which is
 * what lets the web Settings board list them ("Mac • Chrome · Bengaluru, India", Figma 254:567).
 */
export type AccountSession = {
  id: string;
  device: SessionDevice;
  /** The system the row names: "Mac", "iPhone", "Windows". */
  platform: string;
  browser: string;
  /** Coarse, from the sign-in IP the §7.1 audit log already records. */
  location: string;
  /** ISO-8601 */
  lastActiveAt: string;
  /** The session the request came from. */
  current: boolean;
};

/**
 * The account's security cards on the web Settings board (Figma 254:522-590). Only Cognito ever
 * holds the password (V2 §8.4), so the app keeps when it last changed and nothing else about it.
 */
export type AccountSecurity = {
  /** ISO-8601; absent for an account that has only ever signed in with Google or Apple. */
  passwordChangedAt?: string;
  /**
   * The board offers every candidate two-factor sign-in; V2 §7.1 requires MFA of the admin pool
   * only (`toreview.md` §21).
   */
  twoFactorEnabled: boolean;
  /** The current session first, then the rest, most recently active first. */
  sessions: AccountSession[];
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
  /** The backend's download link while ready (P12-11): presigned on each read, short-lived. */
  url?: string;
};
