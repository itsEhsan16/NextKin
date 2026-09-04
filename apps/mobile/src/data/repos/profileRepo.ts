import { simulate } from '@/data/mock';

import { clone, type MockStore, NotFoundError } from './state';
import type { ProfileRepo } from './types';

/** Each completed next-step moves the completeness meter by this much (capped at 1). */
const STEP_WEIGHT = 0.14;

export function createMockProfileRepo(store: MockStore): ProfileRepo {
  return {
    getProfile: () => simulate(() => clone(store.state.profile)),

    completeNextStep: (id) =>
      simulate(() => {
        const { profile } = store.state;
        const step = profile.nextSteps.find((item) => item.id === id);
        if (!step) throw new NotFoundError('NextStep', id);
        store.state.profile = {
          ...profile,
          nextSteps: profile.nextSteps.filter((item) => item.id !== id),
          completeness: Math.min(1, Math.round((profile.completeness + STEP_WEIGHT) * 100) / 100),
        };
        return clone(store.state.profile);
      }),

    updatePreferences: (patch) =>
      simulate(() => {
        const { profile } = store.state;
        store.state.profile = {
          ...profile,
          preferences: { ...profile.preferences, ...patch },
        };
        return clone(store.state.profile);
      }),
  };
}
