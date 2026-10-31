import type { AdoptedDocument } from './adopt';
import type { HttpClient } from './http/client';
import { createHttpGenerationsRepo, GENERATIONS_FALLBACKS } from './http/generationsRepo';
import { createHttpAssistantRepo } from './http/assistantRepo';
import { createHttpSupportRepo } from './http/supportRepo';
import { createHttpInterviewRepo } from './http/interviewRepo';
import { createHttpJdRepo, JD_FALLBACKS } from './http/jdRepo';
import { createHttpJobsRepo, JOBS_FALLBACKS } from './http/jobsRepo';
import { createHttpNotificationsRepo, NOTIFICATIONS_FALLBACKS } from './http/notificationsRepo';
import { createHttpProfileRepo } from './http/profileRepo';
import { createHttpResumesRepo, RESUMES_FALLBACKS } from './http/resumesRepo';
import type { FileUploader } from './http/uploads';
import { createHttpUserRepo, USER_FALLBACKS, type HttpUserRepoOptions } from './http/userRepo';
import type { Job } from '../models/job';
import type { Repos } from './types';

/**
 * The data-source seam (ImBackendImplementationPlan P5-02, old plan C-02/C-08).
 *
 * Each repository is `mock` or `http`, and every one defaults to mock, so flipping a repository
 * is configuration only. An HTTP repository may leave some methods to the mock; those are named in
 * a typed list per repository (`*_FALLBACKS`) and reported by `mockFallbacks()`, and a production
 * configuration that still has one is refused when the repositories are built.
 */

export type DataSource = 'mock' | 'http';
export type RepoName = keyof Repos;

/** The repositories that have an HTTP implementation, and what each still leaves to the mock. */
export const HTTP_FALLBACKS = {
  user: USER_FALLBACKS,
  resumes: RESUMES_FALLBACKS,
  profile: [],
  notifications: NOTIFICATIONS_FALLBACKS,
  jd: JD_FALLBACKS,
  generations: GENERATIONS_FALLBACKS,
  jobs: JOBS_FALLBACKS,
  interview: [],
  assistant: [],
  support: [],
} as const satisfies Partial<Record<RepoName, readonly string[]>>;

/**
 * Fallbacks that stay on the mock in Release 1 by decision, not by being unbuilt, so a production
 * configuration accepts them (ImBackendImplementationPlan L243): job applications (D-05) and link
 * import (D-17: the server never fetches a URL a user gives). Everything else still refuses.
 */
export const STAYS_ON_MOCK: readonly string[] = [
  ...JOBS_FALLBACKS.map((method) => `jobs.${method}`),
  'jd.extract:link',
];

export type HttpRepoName = keyof typeof HTTP_FALLBACKS;
export const HTTP_REPOS = Object.keys(HTTP_FALLBACKS) as HttpRepoName[];

export interface RepoConfig {
  sources?: Partial<Record<RepoName, DataSource>>;
  /** Required when any source is http. */
  http?: HttpClient;
  /** `production` refuses any mock fallback inside an HTTP repository. */
  environment?: 'development' | 'test' | 'production';
  /**
   * Fallbacks a production build may keep, each named (`notifications.list`). Only the AWS demo
   * passes any (toreview §133.1): anything not on the list still refuses, so a new fallback cannot
   * reach a build unnoticed.
   */
  allowedFallbacks?: readonly string[];
  user?: HttpUserRepoOptions;
  /** Posts files to presigned targets (P7-02): `browserUploader` on web, expo-file-system on mobile. */
  uploader?: FileUploader;
  /** Files a server-generated document into the app's library until P10 serves it (P9-08). */
  adopt?: (doc: AdoptedDocument) => void;
  /** Files a server listing into the mock store for the flows that stay there (applying, P11-11). */
  adoptJob?: (job: Job) => void;
}

/**
 * Reads a host's data-source setting: `mock` (or empty) for none, `http` for every repository that
 * has an HTTP implementation, or a comma list such as `user,profile`.
 */
export function parseDataSources(value: string | undefined): Partial<Record<RepoName, DataSource>> {
  const raw = (value ?? '').trim();
  if (!raw || raw === 'mock') return {};
  const names = raw === 'http' ? HTTP_REPOS : raw.split(',').map((name) => name.trim()).filter(Boolean);
  const sources: Partial<Record<RepoName, DataSource>> = {};
  for (const name of names) {
    if (!(HTTP_REPOS as string[]).includes(name)) throw new Error(`No HTTP implementation for the "${name}" repository yet.`);
    sources[name as RepoName] = 'http';
  }
  return sources;
}

/** Every method an HTTP repository in this configuration still answers from the mock. */
export function mockFallbacks(config: RepoConfig): string[] {
  return HTTP_REPOS.filter((name) => config.sources?.[name] === 'http').flatMap((name) =>
    (HTTP_FALLBACKS[name] as readonly string[]).map((method) => `${name}.${method}`),
  );
}

export interface BuiltRepos {
  repos: Repos;
  /** Clears the HTTP repositories' cached ETags (on sign-out). */
  reset(): void;
}

/** Builds the repositories: the mock set, with each http-sourced repository laid over it. */
export function createRepos(config: RepoConfig, mock: Repos): BuiltRepos {
  const http = config.sources ?? {};
  const wanted = HTTP_REPOS.filter((name) => http[name] === 'http');
  if (wanted.length === 0) return { repos: mock, reset: () => {} };
  if (!config.http) throw new Error('An HTTP data source needs an HTTP client.');
  if (config.environment === 'production') {
    const allowed = [...STAYS_ON_MOCK, ...(config.allowedFallbacks ?? [])];
    const fallbacks = mockFallbacks(config).filter((method) => !allowed.includes(method));
    if (fallbacks.length) throw new Error(`Production cannot answer from the mock: ${fallbacks.join(', ')}.`);
  }

  const resets: (() => void)[] = [];
  const repos: Repos = { ...mock };
  if (http.user === 'http') {
    const user = createHttpUserRepo(config.http, { ...config.user, uploader: config.user?.uploader ?? config.uploader });
    resets.push(user.reset);
    repos.user = { ...mock.user, ...user };
  }
  if (http.profile === 'http') {
    const profile = createHttpProfileRepo(config.http);
    resets.push(profile.reset);
    repos.profile = profile;
  }
  if (http.resumes === 'http') {
    if (!config.uploader) throw new Error('The HTTP resumes repository needs an uploader.');
    const resumes = createHttpResumesRepo(config.http, config.uploader, mock.resumes);
    resets.push(resumes.reset);
    const { reset: _reset, ...served } = resumes;
    repos.resumes = { ...mock.resumes, ...served };
  }
  if (http.jd === 'http') {
    const bridge = config.adoptJob && config.adopt ? { adoptJob: config.adoptJob, adoptDocument: config.adopt } : undefined;
    repos.jd = { ...mock.jd, ...createHttpJdRepo(config.http, config.uploader, mock.jd, bridge ? { bridge } : {}) };
  }
  if (http.generations === 'http') {
    if (!config.adopt) throw new Error('The HTTP generations repository needs somewhere to file finished documents.');
    repos.generations = createHttpGenerationsRepo(config.http, mock.generations, config.adopt);
  }
  if (http.jobs === 'http') {
    if (!config.adoptJob) throw new Error('The HTTP jobs repository needs somewhere to file listings for the mock-kept flows.');
    repos.jobs = { ...mock.jobs, ...createHttpJobsRepo(config.http, mock.jobs, config.adoptJob) };
  }
  if (http.support === 'http') {
    repos.support = createHttpSupportRepo(config.http);
  }
  if (http.assistant === 'http') {
    repos.assistant = createHttpAssistantRepo(config.http);
  }
  if (http.interview === 'http') {
    repos.interview = createHttpInterviewRepo(config.http, mock.interview);
  }
  if (http.notifications === 'http') {
    repos.notifications = { ...mock.notifications, ...createHttpNotificationsRepo(config.http) };
  }
  return { repos, reset: () => resets.forEach((reset) => reset()) };
}
