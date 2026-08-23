import { createMockGenerationsRepo } from './generationsRepo';
import { createMockJobsRepo } from './jobsRepo';
import { createMockNotificationsRepo } from './notificationsRepo';
import { createMockProfileRepo } from './profileRepo';
import { createMockResumesRepo } from './resumesRepo';
import { createMockStore, type MockStore } from './state';
import type { Repos } from './types';
import { createMockUserRepo } from './userRepo';

export type { MockState, MockStore } from './state';
export { NotFoundError } from './state';
export * from './types';
export { JOBS_PAGE_SIZE, matchesFilters } from './jobsRepo';
export { GENERATION_PROGRESS_STEP, GENERATION_TICK_MS, statusForProgress } from './generationsRepo';

export function createMockRepos(store: MockStore = createMockStore()): Repos {
  return {
    user: createMockUserRepo(store),
    profile: createMockProfileRepo(store),
    resumes: createMockResumesRepo(store),
    jobs: createMockJobsRepo(store),
    notifications: createMockNotificationsRepo(store),
    generations: createMockGenerationsRepo(store),
  };
}

/** Backing store for the app-wide singleton; exposed so dev tools and tests can reset it. */
export const mockStore: MockStore = createMockStore();

/** App-wide repository singleton. Query hooks import this; screens never do. */
export const repos: Repos = createMockRepos(mockStore);

/** Restores every fixture to its initial state (session mutations are discarded). */
export function resetMockRepos(): void {
  mockStore.reset();
}
