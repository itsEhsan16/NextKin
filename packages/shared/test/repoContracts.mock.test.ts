import { afterEach, beforeEach, describe, vi } from 'vitest';
import { createMockRepos } from '../src/repos';
import { createMockStore } from '../src/repos/state';
import { notificationsRepoContract, profileRepoContract, userRepoContract, type ContractRepos } from './contracts/repoContracts';

/**
 * The repository contract suite against the mock (P5-03). The server's integration tests run the
 * same suite against HTTP. The mock waits 300–900 ms per call; fake timers skip the wait.
 */

/** Wraps every method so each call runs the mock's timers to completion. */
function fast<T extends object>(repo: T): T {
  return new Proxy(repo, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        const pending = (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        pending.catch(() => {}); // observed below; avoids an unhandled rejection while timers run
        await vi.runAllTimersAsync();
        return pending;
      };
    },
  });
}

const make = async (): Promise<ContractRepos> => {
  const repos = createMockRepos(createMockStore());
  return { user: fast(repos.user), profile: fast(repos.profile), notifications: fast(repos.notifications) };
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('mock ProfileRepo meets the contract', () => profileRepoContract(make));
describe('mock UserRepo meets the contract', () => userRepoContract(make));
describe('mock NotificationsRepo meets the contract', () => notificationsRepoContract(make));
