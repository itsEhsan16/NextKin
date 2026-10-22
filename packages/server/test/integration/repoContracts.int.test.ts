import { createMockRepos } from '@nextkin/shared/repos';
import { createRepos } from '@nextkin/shared/repos/create';
import { createHttpClient, type TokenStore } from '@nextkin/shared/repos/http/client';
import { createMockStore } from '@nextkin/shared/repos/state';
import { afterAll, beforeAll, describe } from 'vitest';
import { notificationsRepoContract, profileRepoContract, userRepoContract, type ContractRepos } from '../../../shared/test/contracts/repoContracts';
import { mobileLogin, ORIGIN, registered, startHarness, webLogin, type Harness } from './fixtures/authHarness';

/**
 * The repository contract suite against HTTP on the local stack (ImBackendImplementationPlan
 * P5-03): the same assertions shared's unit tests run against the mock. It runs twice — as the web
 * client (session cookie) and as the mobile client (bearer token, refresh) — through the real
 * HTTP repositories and the whole middleware chain, with `fetch` answered in-process by the API.
 */
let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

/** A fetch that the API answers in-process, as the browser or the phone would send it. */
const inProcess = (extraHeaders: () => Record<string, string>): typeof fetch => (input, init) =>
  h.app.request(String(input), { ...init, headers: { ...(init?.headers as Record<string, string>), ...extraHeaders() } }) as Promise<Response>;

function build(http: ReturnType<typeof createHttpClient>): ContractRepos {
  const { repos } = createRepos({ sources: { user: 'http', profile: 'http', notifications: 'http' }, http }, createMockRepos(createMockStore()));
  return { user: repos.user, profile: repos.profile, notifications: repos.notifications };
}

describe('as the web client (cookie session)', () => {
  let repos: ContractRepos;
  beforeAll(async () => {
    const cookie = await webLogin(h, await registered(h));
    // The browser sends the cookie and, on writes, our Origin.
    repos = build(createHttpClient({ baseUrl: ORIGIN, client: 'web', fetch: inProcess(() => ({ cookie, origin: ORIGIN })) }));
  });
  const make = async () => repos;
  describe('ProfileRepo', () => profileRepoContract(make));
  describe('UserRepo', () => userRepoContract(make));
  describe('NotificationsRepo', () => notificationsRepoContract(make));
});

describe('as the mobile client (bearer token)', () => {
  let repos: ContractRepos;
  beforeAll(async () => {
    let tokens = { ...(await mobileLogin(h, await registered(h))), expiresIn: 3600 };
    const store: TokenStore = { get: async () => tokens, set: async (next) => void (next && (tokens = next)) };
    repos = build(createHttpClient({ baseUrl: ORIGIN, client: 'mobile', platform: 'ios', tokens: store, fetch: inProcess(() => ({})) }));
  });
  const make = async () => repos;
  describe('ProfileRepo', () => profileRepoContract(make));
  describe('UserRepo', () => userRepoContract(make));
  describe('NotificationsRepo', () => notificationsRepoContract(make));
});
