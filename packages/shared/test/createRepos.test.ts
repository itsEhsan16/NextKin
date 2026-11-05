import { describe, expect, it, vi } from 'vitest';
import { createMockRepos } from '../src/repos';
import { createRepos, isFullBackend, mockFallbacks, parseDataSources } from '../src/repos/create';
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
    expect(parseDataSources('http')).toEqual({ user: 'http', events: 'http', resumes: 'http', profile: 'http', notifications: 'http', jd: 'http', generations: 'http', jobs: 'http', interview: 'http', assistant: 'http', support: 'http', admin: 'http' });
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

  it('a production build on the full backend starts, with nothing left on the mock', () => {
    const config = { sources: parseDataSources('http'), http, uploader: async () => {}, adopt: () => {}, adoptJob: () => {}, environment: 'production' as const };
    expect(isFullBackend(config.sources)).toBe(true);
    expect(mockFallbacks(config)).toEqual([]);
    expect(() => createRepos(config, mock())).not.toThrow();
  });

  it('production refuses a partial backend that would answer from the mock', () => {
    const sources = { jd: 'http', generations: 'http' } as const;
    const config = { sources, http, uploader: async () => {}, adopt: () => {}, adoptJob: () => {} };
    expect(mockFallbacks(config)).toContain('jd.compare:from-mock-document');
    expect(() => createRepos({ ...config, environment: 'production' }, mock())).toThrow(/jd\.compare:from-mock-document/);
    expect(() => createRepos({ sources: { profile: 'http' }, http, environment: 'production' }, mock())).not.toThrow();
  });

  it('on the full backend a run or a comparison it cannot serve fails plainly, and never reaches the mock', async () => {
    const config = { sources: parseDataSources('http'), http, uploader: async () => {}, adopt: () => {}, adoptJob: () => {} };
    const { repos } = createRepos(config, mock());
    await expect(repos.generations.start({ kind: 'resume', jobId: 'job_mock' })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    await expect(repos.jd.compare('res_mock', 'job_mock')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});
