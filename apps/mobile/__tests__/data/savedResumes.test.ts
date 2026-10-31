import type { QueryClient } from '@tanstack/react-query';

import { qk } from '@nextkin/shared/queries';

import {
  createAppQueryClient,
  forgetResumes,
  keepResumesSaved,
  restoreResumes,
} from '@/data/savedResumes';

const mockStore = new Map<string, string>();

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockStore.get(key) ?? null,
    setItemSync: (key: string, value: string) => void mockStore.set(key, value),
    removeItemSync: (key: string) => void mockStore.delete(key),
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.2.3' } },
}));

const KEY = 'offline.resumes';
const RESUME = { id: 'res_1', title: 'Stripe resume' };
const BODY = { kind: 'resume', summary: 'Designer' };

/** Writes through the cache, as a successful fetch does, then lets the save run. */
function seed(client: QueryClient) {
  client.setQueryData(qk.resumes.list(), [RESUME]);
  client.setQueryData(qk.resumes.detail('res_1'), RESUME);
  client.setQueryData(qk.resumes.content('res_1'), BODY);
}

describe('saved resumes', () => {
  let stop: () => void;
  let client: QueryClient;

  beforeEach(() => {
    jest.useFakeTimers();
    mockStore.clear();
    client = createAppQueryClient();
    stop = keepResumesSaved(client);
  });

  afterEach(() => {
    stop();
    client.clear();
    jest.useRealTimers();
  });

  it('brings a resume back on the next launch, list and body', () => {
    seed(client);
    jest.advanceTimersByTime(1000);

    const next = createAppQueryClient();
    restoreResumes(next);
    expect(next.getQueryData(qk.resumes.list())).toEqual([RESUME]);
    expect(next.getQueryData(qk.resumes.content('res_1'))).toEqual(BODY);
    next.clear();
  });

  it('keeps only what reading a resume takes', () => {
    seed(client);
    client.setQueryData(qk.resumes.preview('res_1'), { pages: ['https://signed.example/1'] });
    client.setQueryData(['jobs', 'list'], [{ id: 'job_1' }]);
    client.setQueryData(['user', 'profile'], { email: 'a@example.com' });
    jest.advanceTimersByTime(1000);

    const raw = mockStore.get(KEY) ?? '';
    expect(raw).toContain('Stripe resume');
    expect(raw).not.toContain('signed.example');
    expect(raw).not.toContain('job_1');
    expect(raw).not.toContain('a@example.com');
  });

  it('drops a resume that has gone from the list', () => {
    seed(client);
    client.setQueryData(qk.resumes.list(), []);
    jest.advanceTimersByTime(1000);

    const next = createAppQueryClient();
    restoreResumes(next);
    expect(next.getQueryData(qk.resumes.list())).toEqual([]);
    expect(next.getQueryData(qk.resumes.content('res_1'))).toBeUndefined();
    next.clear();
  });

  it('wipes the copy, and leaves nothing to restore', () => {
    seed(client);
    jest.advanceTimersByTime(1000);
    expect(mockStore.has(KEY)).toBe(true);

    forgetResumes();
    expect(mockStore.has(KEY)).toBe(false);

    const next = createAppQueryClient();
    restoreResumes(next);
    expect(next.getQueryData(qk.resumes.list())).toBeUndefined();
    next.clear();
  });

  it('writes nothing after the cache is cleared, even with a save still waiting', () => {
    seed(client);
    client.clear();
    forgetResumes();
    jest.advanceTimersByTime(1000);
    expect(mockStore.has(KEY)).toBe(false);
  });

  it('ignores a copy from another version of the app', () => {
    seed(client);
    jest.advanceTimersByTime(1000);
    const saved = JSON.parse(mockStore.get(KEY) ?? '{}') as { version?: string };
    mockStore.set(KEY, JSON.stringify({ ...saved, version: '1.0.0' }));

    const next = createAppQueryClient();
    restoreResumes(next);
    expect(next.getQueryCache().getAll()).toHaveLength(0);
    next.clear();
  });

  it('survives a damaged copy', () => {
    mockStore.set(KEY, '{not json');
    const next = createAppQueryClient();
    expect(() => restoreResumes(next)).not.toThrow();
    next.clear();
  });

  it('lets requests run and fail with no connection, instead of waiting', () => {
    const { queries, mutations } = client.getDefaultOptions();
    expect(queries?.networkMode).toBe('always');
    expect(mutations?.networkMode).toBe('always');
    expect(queries?.refetchOnReconnect).toBe(true);
  });
});
