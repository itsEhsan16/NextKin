import { simulate } from '@/data/mock';

import { clone, type MockStore } from './state';
import type { UserRepo } from './types';

export function createMockUserRepo(store: MockStore): UserRepo {
  return {
    getCurrentUser: () => simulate(() => clone(store.state.user)),
    getSubscription: () => simulate(() => clone(store.state.subscription)),
  };
}
