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

export type SubscriptionUsage = {
  generationsUsed: number;
  generationsLimit: number;
  coverLettersUsed: number;
  coverLettersLimit: number;
};

export type Subscription = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  /** ISO-8601; absent on the free plan. */
  renewsAt?: string;
  usage: SubscriptionUsage;
};
