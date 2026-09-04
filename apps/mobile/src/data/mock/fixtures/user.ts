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
    coverLettersUsed: 1,
    coverLettersLimit: 2,
    // "2 of 2 free resumes used" (Figma 1:1388) · "5 AI credits left" (1:2233).
    resumesUsed: 2,
    resumesLimit: 2,
    aiCreditsLeft: 5,
  },
};

/** Home shortcut-grid counters (DESIGN 2 artboard copy). */
export const dashboardStatsFixture: DashboardStats = {
  resumesCount: 12,
  activitiesCount: 24,
  savedJobsCount: 18,
};
