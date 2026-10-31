import { describe, expect, it, vi } from 'vitest';
import { createMockRepos } from '../src/repos';
import { createRepos, mockFallbacks, parseDataSources } from '../src/repos/create';
import { createHttpClient } from '../src/repos/http/client';
import { createMockStore } from '../src/repos/state';

/** The data-source seam (P5-02): configuration picks mock or HTTP per repository. */

const http = createHttpClient({ baseUrl: 'http://api.test', client: 'web', fetch: vi.fn() });
const mock = () => createMockRepos(createMockStore());

describe('parseDataSources', () => {
  it('empty or mock means every repository stays on the mock', () => {
    expect(parseDataSources(undefined)).toEqual({});
    expect(parseDataSources('mock')).toEqual({});
  });
  it('http flips every repository that has an HTTP implementation; a list flips those only', () => {
    expect(parseDataSources('http')).toEqual({ user: 'http', resumes: 'http', profile: 'http', notifications: 'http', jd: 'http', generations: 'http', jobs: 'http', interview: 'http', assistant: 'http', support: 'http' });
    expect(parseDataSources('profile, user')).toEqual({ profile: 'http', user: 'http' });
  });
  it('naming a repository with no HTTP implementation is an error, not a silent mock', () => {
    expect(() => parseDataSources('insights')).toThrow(/insights/);
  });
});

describe('createRepos', () => {
  it('with no http source, the mock set is returned untouched', () => {
    const repos = mock();
    expect(createRepos({}, repos).repos).toBe(repos);
  });

  it('flips only the configured repositories; unserved methods stay on the mock', () => {
    const repos = mock();
    const built = createRepos({ sources: { user: 'http' }, http }, repos).repos;
    expect(built.profile).toBe(repos.profile);
    expect(built.user.getCurrentUser).not.toBe(repos.user.getCurrentUser);
  });

  it('needs an HTTP client for an http source', () => {
    expect(() => createRepos({ sources: { profile: 'http' } }, mock())).toThrow(/HTTP client/);
  });

  it('lists every fallback, and production refuses to build with one', () => {
    const config = { sources: parseDataSources('http'), http, uploader: async () => {} };
    expect(mockFallbacks(config).some((m) => m.startsWith('user.'))).toBe(false);
    expect(mockFallbacks(config)).toContain('notifications.list');
    expect(mockFallbacks(config).some((m) => m.startsWith('profile.'))).toBe(false);
    expect(() => createRepos({ ...config, environment: 'production' }, mock())).toThrow(/notifications\.list/);
    expect(() => createRepos({ sources: { profile: 'http' }, http, environment: 'production' }, mock())).not.toThrow();
  });

  it('lets a production build keep only the fallbacks it names', () => {
    // configureRepos supplies adopt and adoptJob; createRepos needs them spelled out.
    const config = {
      sources: parseDataSources('http'),
      http,
      uploader: async () => {},
      adopt: () => {},
      adoptJob: () => {},
      environment: 'production' as const,
    };
    const all = mockFallbacks(config);
    expect(() => createRepos({ ...config, allowedFallbacks: all }, mock())).not.toThrow();
    const allButOne = all.filter((m) => m !== 'notifications.list');
    expect(() => createRepos({ ...config, allowedFallbacks: allButOne }, mock())).toThrow(/notifications\.list/);
  });
});
