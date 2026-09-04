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
