import type { DashboardStats, Subscription, User } from '@/data/models';

import { daysAgo, daysFromNow } from './time';

export const USER_ID = 'usr_george';

export const userFixture: User = {
  id: USER_ID,
  email: 'george.miller@example.com',
  firstName: 'George',
  lastName: 'Miller',
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
  },
};

/** Home shortcut-grid counters (DESIGN 2 artboard copy). */
export const dashboardStatsFixture: DashboardStats = {
  resumesCount: 12,
  activitiesCount: 24,
  savedJobsCount: 18,
};
