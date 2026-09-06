import type { DashboardStats, Subscription, User } from '@/data/models';

import { daysAgo, daysFromNow } from './time';

export const USER_ID = 'usr_george';

/** PROFILE 01 (Figma 1:2201) names him George Smith; Home only ever shows the first name. */
export const userFixture: User = {
  id: USER_ID,
  email: 'george.smith@example.com',
  firstName: 'George',
  lastName: 'Smith',
  avatarUrl: 'asset:avatar-george',
  createdAt: daysAgo(74),
};

export const subscriptionFixture: Subscription = {
  plan: 'free',
  status: 'active',
  renewsAt: daysFromNow(30),
  usage: {
    generationsUsed: 2,
    generationsLimit: 3,
    // 1 a month on Free (V2 §13.3), so this account has spent it — which is the state the
    // cover-letter setup screen's quota upsell needs. No artboard sets this number; the "2" it
    // held before was invented and contradicted the plan table PLAN_FEATURES renders.
    coverLettersUsed: 1,
    coverLettersLimit: 1,
    // "2 of 2 free resumes used" (Figma 1:1388) · "5 AI credits left" (1:2233).
    resumesUsed: 2,
    resumesLimit: 2,
    aiCreditsLeft: 5,
    // The remaining §13.3 meters. No artboard sets them; these are the Free-tier caps from the
    // spec's own table (PLAN_FEATURES), part-spent so the plan screen has something to draw.
    atsChecksUsed: 1,
    atsChecksLimit: 3,
    assistantMessagesUsed: 12,
    assistantMessagesLimit: 20,
    interviewSetsUsed: 1,
    interviewSetsLimit: 1,
  },
};

/** Home shortcut-grid counters (DESIGN 2 artboard copy). */
export const dashboardStatsFixture: DashboardStats = {
  resumesCount: 12,
  activitiesCount: 25,
  savedJobsCount: 18,
};
