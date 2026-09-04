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
    it('returns the first 20 jobs in relevance order with a cursor for the rest', async () => {
      // "Relevance" is the default sort on the Jobs artboard (Figma 1:326), not recency.
      const page = await flush(repos.jobs.list(EMPTY_JOB_FILTERS));

      expect(page.items).toHaveLength(JOBS_PAGE_SIZE);
      expect(page.nextCursor).toBeDefined();
      const ranks = page.items.map((job) => job.relevanceRank);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    });

    it('re-orders by recency when the sort control asks for it', async () => {
      const page = await flush(repos.jobs.list(EMPTY_JOB_FILTERS, undefined, 'recent'));

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

  describe('experience and salary filters (JOBS 04)', () => {
    it('filters by experience level', async () => {
      const page = await flush(
        repos.jobs.list({ ...EMPTY_JOB_FILTERS, experienceLevels: ['lead'] }),
      );

      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.every((job) => job.experienceLevel === 'lead')).toBe(true);
    });

    it('every Job type pill returns something, so no filter is a dead end', async () => {
      for (const type of ['full_time', 'part_time', 'contract', 'internship'] as const) {
        const total = await flush(
          repos.jobs.count({ ...EMPTY_JOB_FILTERS, employmentTypes: [type] }),
        );
        expect(total).toBeGreaterThan(0);
      }
    });

    it('every Experience pill returns something', async () => {
      for (const level of ['entry', 'mid', 'senior', 'lead'] as const) {
        const total = await flush(
          repos.jobs.count({ ...EMPTY_JOB_FILTERS, experienceLevels: [level] }),
        );
        expect(total).toBeGreaterThan(0);
      }
    });

    it('keeps a listing whose band overlaps the requested one', async () => {
      // job_zoho is ₹18–24L, so it survives a ₹20L floor but not a ₹15L ceiling.
      const above = await flush(repos.jobs.list({ ...EMPTY_JOB_FILTERS, salaryMin: 2_000_000 }));
      expect(above.items.some((job) => job.id === 'job_zoho')).toBe(true);

      const below = await flush(repos.jobs.list({ ...EMPTY_JOB_FILTERS, salaryMax: 1_500_000 }));
      expect(below.items.some((job) => job.id === 'job_zoho')).toBe(false);
    });

    it('compares foreign salaries in INR rather than raw digits', async () => {
      // job_9 is Shopify at USD 120–150k: worth well over ₹20L, and previously excluded outright
      // because 120000 < 2000000 as a bare number.
      const page = await flush(repos.jobs.list({ ...EMPTY_JOB_FILTERS, salaryMin: 2_000_000 }));
      expect(page.items.some((job) => job.id === 'job_9')).toBe(true);

      const capped = await flush(repos.jobs.list({ ...EMPTY_JOB_FILTERS, salaryMax: 2_000_000 }));
      expect(capped.items.some((job) => job.id === 'job_9')).toBe(false);
    });

    it('excludes a listing that quotes no salary whenever a bound is set', async () => {
      // job_21 (BMW) is the one fixture with no salary at all.
      const unfiltered = await flush(repos.jobs.count(EMPTY_JOB_FILTERS));
      const bounded = await flush(repos.jobs.count({ ...EMPTY_JOB_FILTERS, salaryMin: 1 }));

      expect(unfiltered).toBe(jobsFixture.length);
      expect(bounded).toBe(jobsFixture.length - 1);
    });
  });

  describe('listSimilar()', () => {
    it('ranks by shared tags and never returns the job itself or its own company', async () => {
      const similar = await flush(repos.jobs.listSimilar('job_stripe'));

      expect(similar.length).toBeGreaterThan(0);
      expect(similar.length).toBeLessThanOrEqual(3);
      expect(similar.some((job) => job.id === 'job_stripe')).toBe(false);
      expect(similar.some((job) => job.company === 'Stripe')).toBe(false);
      // Every result shares at least one tag with the source job.
      const tags = new Set(['Fintech', 'Design systems', 'Figma']);
      expect(similar.every((job) => job.tags.some((tag) => tags.has(tag)))).toBe(true);
    });

    it('honours the limit and returns nothing in empty mode', async () => {
      expect(await flush(repos.jobs.listSimilar('job_stripe', 1))).toHaveLength(1);

      useMockModeStore.setState({ mode: 'empty' });
      expect(await flush(repos.jobs.listSimilar('job_stripe'))).toEqual([]);
    });
  });

  describe('count()', () => {
    it('agrees with what list() would page through', async () => {
      const filters = { ...EMPTY_JOB_FILTERS, remote: ['remote' as const] };
      const total = await flush(repos.jobs.count(filters));
      const first = await flush(repos.jobs.list(filters));
      const rest = first.nextCursor
        ? await flush(repos.jobs.list(filters, first.nextCursor))
        : { items: [] };

      expect(total).toBe(first.items.length + rest.items.length);
    });

    it('is sort-independent', async () => {
      const relevance = await flush(repos.jobs.count(EMPTY_JOB_FILTERS));
      const recent = await flush(repos.jobs.count(EMPTY_JOB_FILTERS));
      expect(relevance).toBe(recent);
    });

    it('returns 0 in empty mode and rejects in error mode', async () => {
      useMockModeStore.setState({ mode: 'empty' });
      expect(await flush(repos.jobs.count(EMPTY_JOB_FILTERS))).toBe(0);

      useMockModeStore.setState({ mode: 'error' });
      await expect(flush(repos.jobs.count(EMPTY_JOB_FILTERS))).rejects.toBeInstanceOf(MockError);
    });
  });

  it('reset() restores fixture state', async () => {
    await flush(repos.jobs.toggleSave('job_1'));
    resetMockRepos();
    const job = await flush(repos.jobs.get('job_1'));
    expect(job.isSaved).toBe(false);
  });
});
