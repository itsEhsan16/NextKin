import { jobsFixture, MockError, useMockModeStore } from '@/data/mock';
import { EMPTY_JOB_FILTERS } from '@/data/models';
import { JOBS_PAGE_SIZE, mockStore, repos, resetMockRepos } from '@/data/repos';

/** Resolves a repo promise by flushing mock latency under fake timers. */
async function flush<T>(promise: Promise<T>): Promise<T> {
  const [value] = await Promise.all([promise, jest.advanceTimersByTimeAsync(3000)]);
  return value;
}

describe('JobsRepo (mock)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
    resetMockRepos();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('list() pagination', () => {
    it('returns the first 20 jobs newest-first with a cursor for the rest', async () => {
      const page = await flush(repos.jobs.list(EMPTY_JOB_FILTERS));

      expect(page.items).toHaveLength(JOBS_PAGE_SIZE);
      expect(page.nextCursor).toBeDefined();
      const posted = page.items.map((job) => job.postedAt);
      expect(posted).toEqual([...posted].sort((a, b) => b.localeCompare(a)));
    });

    it('returns the remaining jobs on the second page without a cursor', async () => {
      const first = await flush(repos.jobs.list(EMPTY_JOB_FILTERS));
      const second = await flush(repos.jobs.list(EMPTY_JOB_FILTERS, first.nextCursor));

      expect(second.items).toHaveLength(jobsFixture.length - JOBS_PAGE_SIZE);
      expect(second.nextCursor).toBeUndefined();

      const ids = new Set([...first.items, ...second.items].map((job) => job.id));
      expect(ids.size).toBe(jobsFixture.length);
    });

    it('applies filters before paginating', async () => {
      const page = await flush(
        repos.jobs.list({ ...EMPTY_JOB_FILTERS, remote: ['remote'], query: 'designer' }),
      );

      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.every((job) => job.remote === 'remote')).toBe(true);
      expect(page.nextCursor).toBeUndefined();
    });

    it('returns an empty page in empty mode', async () => {
      useMockModeStore.setState({ mode: 'empty' });
      const page = await flush(repos.jobs.list(EMPTY_JOB_FILTERS));
      expect(page).toEqual({ items: [] });
    });
  });

  describe('toggleSave()', () => {
    it('flips isSaved and persists for the session', async () => {
      const before = await flush(repos.jobs.get('job_1'));
      expect(before.isSaved).toBe(false);

      const toggled = await flush(repos.jobs.toggleSave('job_1'));
      expect(toggled.isSaved).toBe(true);

      const after = await flush(repos.jobs.get('job_1'));
      expect(after.isSaved).toBe(true);

      const saved = await flush(repos.jobs.listSaved());
      expect(saved.map((job) => job.id)).toContain('job_1');
    });

    it('toggles back off and leaves the saved list', async () => {
      await flush(repos.jobs.toggleSave('job_2'));
      const saved = await flush(repos.jobs.listSaved());
      expect(saved.map((job) => job.id)).not.toContain('job_2');
    });

    it('does not mutate the fixture or leak references into callers', async () => {
      const job = await flush(repos.jobs.toggleSave('job_1'));
      job.title = 'mutated';
      const fresh = await flush(repos.jobs.get('job_1'));
      expect(fresh.title).not.toBe('mutated');
      expect(jobsFixture.find((item) => item.id === 'job_1')?.isSaved).toBe(false);
    });

    it('rejects for unknown ids', async () => {
      await expect(flush(repos.jobs.toggleSave('nope'))).rejects.toThrow('Job "nope" not found');
    });

    it('rejects with MockError in error mode and leaves state untouched', async () => {
      useMockModeStore.setState({ mode: 'error' });
      await expect(flush(repos.jobs.toggleSave('job_1'))).rejects.toBeInstanceOf(MockError);
      expect(mockStore.state.jobs.find((job) => job.id === 'job_1')?.isSaved).toBe(false);
    });
  });

  it('reset() restores fixture state', async () => {
    await flush(repos.jobs.toggleSave('job_1'));
    resetMockRepos();
    const job = await flush(repos.jobs.get('job_1'));
    expect(job.isSaved).toBe(false);
  });
});
