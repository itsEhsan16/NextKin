import type { Subscription, User } from '@/data/models';

import { daysAgo, daysFromNow } from './time';

export const USER_ID = 'usr_george';

export const userFixture: User = {
  id: USER_ID,
  email: 'george.miller@example.com',
  firstName: 'George',
  lastName: 'Miller',
  avatarUrl: undefined,
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
