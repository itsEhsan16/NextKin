import { companyFromHost, titleFromPath, useMockModeStore } from '@/data/mock';
import { EMPTY_JOB_FILTERS, jobLinkIn } from '@/data/models';
import { createMockRepos, type Repos } from '@/data/repos';
import { createMockStore, type MockStore } from '@/data/repos/state';

/** Resolves a repo promise by flushing mock latency under fake timers. */
async function flush<T>(promise: Promise<T>): Promise<T> {
  const [value] = await Promise.all([promise, jest.advanceTimersByTimeAsync(3000)]);
  return value;
}

const SWIGGY = 'https://careers.swiggy.com/jobs/senior-product-designer-4821';

describe('copied job links (TAILOR 00c)', () => {
  let store: MockStore;
  let repos: Repos;

  beforeEach(() => {
    jest.useFakeTimers();
    useMockModeStore.setState({ mode: 'normal' });
    store = createMockStore();
    repos = createMockRepos(store);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('asks only about a lone link that reads as a job', () => {
    expect(jobLinkIn(SWIGGY)).toBe(SWIGGY);
    expect(jobLinkIn('  cred.club/careers/senior-interaction-designer ')).toBe(
      'cred.club/careers/senior-interaction-designer',
    );
    expect(jobLinkIn('https://www.linkedin.com/jobs/view/3912345678')).not.toBeNull();
    expect(jobLinkIn('https://www.linkedin.com/')).toBeNull();
    expect(jobLinkIn('https://www.youtube.com/watch?v=abc')).toBeNull();
    expect(jobLinkIn('Apply at careers.swiggy.com/jobs/1 today')).toBeNull();
    expect(jobLinkIn('just some copied words')).toBeNull();
    expect(jobLinkIn(null)).toBeNull();
  });

  it('reads the employer from the host and the role from the path', () => {
    expect(companyFromHost('careers.swiggy.com')).toBe('Swiggy');
    expect(companyFromHost('cred.club')).toBe('CRED');
    expect(companyFromHost('jobs.lever.co')).toBeUndefined();
    expect(companyFromHost('linkedin.com')).toBeUndefined();
    expect(titleFromPath(SWIGGY)).toBe('Senior Product Designer');
    expect(titleFromPath('https://acme.com/careers/ux-researcher-ii/')).toBe('UX Researcher Ii');
    expect(titleFromPath('https://www.linkedin.com/jobs/view/3912345678')).toBeUndefined();
  });

  it('names the job without keeping anything, and refuses a page that blocks reading', async () => {
    const before = store.state.jobs.length;
    const preview = await flush(repos.jobs.readLink(SWIGGY));
    expect(preview).toEqual({
      url: SWIGGY,
      host: 'careers.swiggy.com',
      title: 'Senior Product Designer',
      company: 'Swiggy',
    });
    expect(store.state.jobs).toHaveLength(before);
    await expect(
      flush(repos.jobs.readLink('https://careers.blocked-site.example/jobs/designer-1')),
    ).rejects.toMatchObject({ code: 'UNREADABLE_LINK' });
  });

  it('adds an outside job to Saved jobs once, and keeps it out of search', async () => {
    const job = await flush(repos.jobs.importFromLink(SWIGGY));
    expect(job).toMatchObject({
      title: 'Senior Product Designer',
      company: 'Swiggy',
      companyWebsite: 'careers.swiggy.com',
      source: 'manual',
      sourceUrl: SWIGGY,
      isSaved: true,
      isPick: false,
    });
    const again = await flush(repos.jobs.importFromLink(SWIGGY));
    expect(again.id).toBe(job.id);
    expect(store.state.jobs.filter((item) => item.sourceUrl === SWIGGY)).toHaveLength(1);

    const saved = await flush(repos.jobs.listSaved());
    expect(saved.map((item) => item.id)).toContain(job.id);
    const search = await flush(repos.jobs.list({ ...EMPTY_JOB_FILTERS, query: 'Swiggy' }));
    expect(search.items).toHaveLength(0);
    expect(await flush(repos.jobs.count({ ...EMPTY_JOB_FILTERS, query: 'Swiggy' }))).toBe(0);

    // Tailor reads it like any NextKin job.
    const comparison = await flush(repos.jd.compare('res_base', job.id));
    expect(comparison.keywords.length).toBeGreaterThan(0);
  });

  it('saves the NextKin job a link points at instead of adding a copy', async () => {
    const url = 'https://cred.club/careers/senior-interaction-designer';
    const before = store.state.jobs.length;
    const preview = await flush(repos.jobs.readLink(url));
    expect(preview).toMatchObject({ title: 'Senior Interaction Designer', company: 'CRED' });

    const job = await flush(repos.jobs.importFromLink(url));
    expect(job.id).toBe('job_cred');
    expect(job.isSaved).toBe(true);
    expect(store.state.jobs).toHaveLength(before);
  });
});
