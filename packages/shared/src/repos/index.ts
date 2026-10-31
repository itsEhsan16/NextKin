import { createMockAssistantRepo } from './assistantRepo';
import { adoptDocument, adoptJob } from './adopt';
import { createMockDocumentsRepo } from './documentsRepo';
import { createMockGenerationsRepo } from './generationsRepo';
import { createMockInsightsRepo } from './insightsRepo';
import { createMockInterviewRepo } from './interviewRepo';
import { createMockJdRepo } from './jdRepo';
import { createMockJobsRepo } from './jobsRepo';
import { createMockNotificationsRepo } from './notificationsRepo';
import { createMockProfileRepo } from './profileRepo';
import { createMockResumesRepo } from './resumesRepo';
import { clearSampleData, createMockStore, type MockStore } from './state';
import { createMockSupportRepo } from './supportRepo';
import type { Repos } from './types';
import { createRepos, isFullBackend, type RepoConfig } from './create';
import { createMockUserRepo } from './userRepo';

export type { MockState, MockStore } from './state';
export { NotFoundError } from './state';
export * from './types';
export { JOBS_PAGE_SIZE, matchesFilters } from './jobsRepo';
export { GENERATION_PROGRESS_STEP, GENERATION_TICK_MS, statusForProgress } from './generationsRepo';
export { ConsentRequiredError, ExportBlockedError, PlanLockedError } from './state';

export { DATA_EXPORT_MS } from './userRepo';
export { ASSISTANT_TICK_MS } from './assistantRepo';
export { createRepos, HTTP_FALLBACKS, HTTP_REPOS, isFullBackend, mockFallbacks, parseDataSources } from './create';
export type { DataSource, RepoConfig, RepoName } from './create';
export { ApiError, collectPages, createHttpClient } from './http/client';
export type { HttpClient, HttpClientOptions, TokenStore } from './http/client';
export { browserUploader } from './http/uploads';
export type { FileUploader } from './http/uploads';

export function createMockRepos(store: MockStore = createMockStore()): Repos {
  return {
    user: createMockUserRepo(store),
    profile: createMockProfileRepo(store),
    resumes: createMockResumesRepo(store),
    jobs: createMockJobsRepo(store),
    jd: createMockJdRepo(store),
    notifications: createMockNotificationsRepo(store),
    events: { send: async () => undefined },
    generations: createMockGenerationsRepo(store),
    support: createMockSupportRepo(store),
    interview: createMockInterviewRepo(store),
    assistant: createMockAssistantRepo(store),
    documents: createMockDocumentsRepo(store),
    insights: createMockInsightsRepo(),
  };
}

/** Backing store for the app-wide singleton; exposed so dev tools and tests can reset it. */
export const mockStore: MockStore = createMockStore();

/**
 * App-wide repository singleton. Query hooks import this; screens never do. It starts as the mock
 * set; a host that talks to the backend calls `configureRepos` once at module scope, before the
 * first render (the same contract as `configureMockPlatform`), and the properties are swapped in
 * place so every hook that already imported `repos` sees the change.
 */
export const repos: Repos = createMockRepos(mockStore);

let resetHttp: () => void = () => {};
let sampleData = true;

export function configureRepos(config: RepoConfig): void {
  const built = createRepos(
    { adopt: (doc) => adoptDocument(mockStore, doc), adoptJob: (job) => adoptJob(mockStore, job), ...config },
    createMockRepos(mockStore),
  );
  Object.assign(repos, built.repos);
  resetHttp = built.reset;
  // Sample data must not reach anyone on the real backend, even as a fallback.
  sampleData = !isFullBackend(config.sources);
  if (!sampleData) clearSampleData(mockStore);
}

/** Restores every fixture to its initial state (session mutations are discarded). */
export function resetMockRepos(): void {
  mockStore.reset();
}

/**
 * The sign-out reset for whichever source each repository uses: the mock goes back to its
 * fixtures and the HTTP repositories forget their cached versions. Ending the server session and
 * dropping tokens is the auth client's job; the caches are the query client's.
 */
export function resetRepos(): void {
  resetMockRepos();
  if (!sampleData) clearSampleData(mockStore);
  resetHttp();
}
