import { useMockModeStore } from '@/data/mock';
import {
  buildChanges,
  buildHeadline,
  compareProfileToJob,
  profileKeywordFit,
  type JdDraft,
} from '@/data/models';
import { createMockRepos, GENERATION_TICK_MS, type Repos } from '@/data/repos';
import { createMockStore, type MockStore } from '@/data/repos/state';

/** Resolves a repo promise by flushing mock latency under fake timers. */
async function flush<T>(promise: Promise<T>): Promise<T> {
  const [value] = await Promise.all([promise, jest.advanceTimersByTimeAsync(3000)]);
  return value;
}

const draft = (required: string[], preferred: string[]): JdDraft =>
  ({
    id: 'jd_x',
    source: 'paste',
    createdAt: '2026-10-03T00:00:00.000Z',
    title: 'Senior Product Designer',
    company: 'CRED',
    requiredSkills: required,
    preferredSkills: preferred,
    responsibilities: [],
    tools: [],
    rawText: '',
  }) as JdDraft;

describe('Build Resume (BUILD 01–07, toreview §67 / §74)', () => {
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

  it('reads what the job asks for against the profile, backed skills first, once each', () => {
    const fit = profileKeywordFit(draft(['Fintech', 'Figma', 'figma'], ['Design systems']), [
      'Figma',
      'Design systems',
    ]);
    expect(fit).toEqual([
      { label: 'Figma', onProfile: true },
      { label: 'Design systems', onProfile: true },
      { label: 'Fintech', onProfile: false },
    ]);
  });

  it('lists only what a build does, and each keyword it refused to add', () => {
    const fit = [
      { label: 'Figma', onProfile: true },
      { label: 'Fintech', onProfile: false },
    ];
    expect(buildChanges('CRED', fit)).toEqual([
      { label: 'Summary aimed at the CRED role', left: false },
      { label: 'Skills ordered to match the job', left: false },
      { label: 'Fintech left out — it is not on your profile', left: true },
    ]);
    expect(buildChanges(undefined, [])).toEqual([
      { label: 'Summary aimed at this role', left: false },
    ]);
  });

  it('says what the user answered on BUILD 04c, never what the profile lacked', () => {
    const fit = [
      { label: 'Figma', onProfile: true },
      { label: 'User research', onProfile: false },
      { label: 'Fintech / payments', onProfile: false },
    ];
    expect(
      buildChanges('CRED', fit, { added: ['User research'], skipped: ['Fintech / payments'] }),
    ).toEqual([
      { label: 'Summary aimed at the CRED role', left: false },
      { label: 'Skills ordered to match the job', left: false },
      { label: 'Added user research', left: false },
      { label: 'Fintech left out, as you chose', left: true },
    ]);
  });

  it('compares the profile with the job as coverage, never as an ATS score (BUILD 04b, D-15)', () => {
    const skills = ['Figma', 'Design systems', 'Prototyping'];
    const experiences = [{ id: 'exp', company: 'Flipkart', title: 'Senior UX Designer', startDate: '2020-01-01', current: true, skills }];
    const result = compareProfileToJob(draft(['Figma', 'Fintech'], ['Design systems', 'Prototyping']), {
      headline: 'Senior UX Designer',
      skills,
      experiences,
    });
    // The requirement ledger (C-10): required counts twice preferred, so Figma met and Fintech
    // missing of the required, both preferred met: (2 + 1 + 1) of (2 + 2 + 1 + 1) = 67.
    expect(result.score).toBe(67);
    // D-14: a skill the profile only lists, with no dated role behind it, earns half.
    expect(compareProfileToJob(draft(['Figma', 'Fintech'], ['Design systems', 'Prototyping']), { headline: 'x', skills }).score).toBe(33);
    expect(result.keywords).toEqual([
      { label: 'Figma', onResume: true, source: 'required' },
      { label: 'Design systems', onResume: true, source: 'description' },
      { label: 'Prototyping', onResume: true, source: 'description' },
      { label: 'Fintech', onResume: false, source: 'required' },
    ]);
    expect(result.improvements.map((row) => [row.key, row.ok])).toEqual([
      ['headline', false],
      ['summary', false],
      ['skills', false],
      ['layout', true],
    ]);
    expect(result.improvements[0]?.detail).toBe(
      'Says Senior UX Designer. This job is Senior Product Designer.',
    );
    expect(result.improvements[2]?.detail).toBe('We’ll lead with what CRED asks for.');
    // A job that asks for nothing measurable is fully covered, and a matching headline is fine.
    const empty = compareProfileToJob(draft([], []), {
      headline: 'Senior Product Designer',
      skills: [],
    });
    expect(empty.score).toBe(100);
    expect(empty.improvements[0]?.ok).toBe(true);
  });

  it('words the headline from the band of the match, so a weak one is not flattered', () => {
    expect(buildHeadline(90).title).toBe('A strong match.\nA few touches left');
    expect(buildHeadline(75).lede('CRED')).toBe(
      'Your profile covers most of what CRED asks for. A few fixes will make the resume stronger.',
    );
    expect(buildHeadline(30).title).toBe('Some work to do.\nLet’s close the gaps');
  });

  it('reads a saved job once for a build, and compares against that same reading', async () => {
    const first = await flush(repos.jd.forJob('job_stripe'));
    const second = await flush(repos.jd.forJob('job_stripe'));
    expect(second.id).toBe(first.id);
    expect(first.jobId).toBe('job_stripe');
    const comparison = await flush(repos.jd.compare('res_base', 'job_stripe'));
    expect(comparison.jdId).toBe(first.id);
  });

  it('builds from the profile with what the user added, job asks first (BUILD 04c → 06)', async () => {
    const jd = await flush(repos.jd.forJob('job_stripe'));
    const missing = compareProfileToJob(jd, store.state.profile).keywords.find(
      (keyword) => !keyword.onResume,
    );
    expect(missing).toBeDefined();
    const added = missing?.label ?? '';
    const before = store.state.profile.skills.length;

    const generation = await flush(
      repos.generations.start({
        kind: 'resume',
        jdId: jd.id,
        jobId: 'job_stripe',
        origin: 'build',
        build: { added: [added], skipped: [] },
      }),
    );
    expect(generation.build).toEqual({ added: [added], skipped: [] });
    // What the user said they have is theirs: it goes on the profile, once.
    expect(store.state.profile.skills).toHaveLength(before + 1);
    expect(store.state.profile.skills).toContain(added);

    repos.generations.subscribe(generation.id, () => undefined);
    await jest.advanceTimersByTimeAsync(GENERATION_TICK_MS * 12);
    const done = store.state.generations.find((item) => item.id === generation.id);
    expect(done?.status).toBe('ready');
    const body = store.state.contents[done?.resumeId ?? ''];
    const skills = body?.kind === 'resume' ? body.skills : [];
    expect(skills).toContain(added);
    const asks = new Set([...jd.requiredSkills, ...jd.preferredSkills].map((s) => s.toLowerCase()));
    const firstOther = skills.findIndex((skill) => !asks.has(skill.toLowerCase()));
    const lastAsk = skills.map((skill) => asks.has(skill.toLowerCase())).lastIndexOf(true);
    // Every skill the job asks for comes before every one it does not.
    expect(firstOther === -1 || lastAsk < firstOther).toBe(true);
  });

  it('refuses a job page whose site blocks reading with a reason the flow recognises (BUILD 05b)', async () => {
    await expect(
      flush(
        repos.jd.extract({ source: 'link', url: 'https://careers.blocked-site.example/jobs/123' }),
      ),
    ).rejects.toMatchObject({ code: 'UNREADABLE_LINK' });
    const read = await flush(
      repos.jd.extract({ source: 'link', url: 'cred.club/careers/senior-product-designer' }),
    );
    expect(read.sourceUrl).toBe('cred.club/careers/senior-product-designer');
  });

  it('remembers a build run as one', async () => {
    const extracted = await flush(repos.jd.extract({ source: 'job', jobId: 'job_stripe' }));
    const generation = await flush(
      repos.generations.start({
        kind: 'resume',
        jdId: extracted.id,
        jobId: 'job_stripe',
        origin: 'build',
      }),
    );
    expect(generation.origin).toBe('build');
  });
});
