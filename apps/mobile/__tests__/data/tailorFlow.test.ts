import { useMockModeStore } from '@/data/mock';
import {
  fixCount,
  missingKeywords,
  tailorChanges,
  tailorHeadline,
  type TailorRun,
} from '@/data/models';
import { createMockRepos, GENERATION_TICK_MS, type Repos } from '@/data/repos';
import { createMockStore, type MockStore } from '@/data/repos/state';

/** Resolves a repo promise by flushing mock latency under fake timers. */
async function flush<T>(promise: Promise<T>): Promise<T> {
  const [value] = await Promise.all([promise, jest.advanceTimersByTimeAsync(3000)]);
  return value;
}

describe('job-first tailoring (toreview §56)', () => {
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

  it('compares the base resume with Stripe: the engine’s score and keywords, the board’s rows', async () => {
    const comparison = await flush(repos.jd.compare('res_base', 'job_stripe'));

    // Engine-computed (C-10): Stripe's listing reads as Design systems and Figma required, both on
    // the resume, and Fintech preferred, which nothing on it shows. TAILOR 02's 72 and its eight
    // seeded keywords were board copy, replaced by what the engines measure.
    expect(comparison.score).toBe(90);
    expect(comparison.keywords).toHaveLength(3);
    expect(comparison.keywords.filter((k) => k.onResume)).toHaveLength(2);
    expect(missingKeywords(comparison).map((k) => k.label)).toEqual(['Fintech']);
    expect(fixCount(comparison)).toBe(3);
    expect(comparison.pageCount).toBe(3);
    // The extraction the run will tailor to is saved, and a second comparison reuses it.
    const again = await flush(repos.jd.compare('res_1', 'job_stripe'));
    expect(again.jdId).toBe(comparison.jdId);
  });

  it('derives a comparison for any other pair, with a score inside the rubric range', async () => {
    const comparison = await flush(repos.jd.compare('res_1', 'job_linear'));
    expect(comparison.score).toBeGreaterThanOrEqual(30);
    expect(comparison.score).toBeLessThanOrEqual(95);
    expect(comparison.improvements.map((row) => row.key)).toEqual([
      'headline',
      'summary',
      'length',
      'layout',
    ]);
  });

  it('heads the page by band', () => {
    expect(tailorHeadline(72).title).toBe('A good start.\nLet’s make it stronger');
    expect(tailorHeadline(72).lede('Stripe')).toContain('most of what Stripe asks for');
  });

  it('lists only what the run did, skipped keywords last', () => {
    const run: TailorRun = {
      sourceResumeId: 'res_base',
      baselineScore: 72,
      sourcePages: 3,
      added: ['Merchant onboarding', 'Usability testing'],
      skipped: ['Fintech / payments'],
    };
    expect(tailorChanges(run)).toEqual([
      { label: 'Headline and summary aimed at this role', left: false },
      { label: 'Added merchant onboarding and usability testing', left: false },
      { label: 'Trimmed from 3 pages to 2', left: false },
      { label: 'Fintech left out, as you chose', left: true },
    ]);
    expect(tailorChanges({ ...run, sourcePages: 2, added: [], skipped: [] })).toHaveLength(1);
  });

  it('runs the tailoring to ready: an added keyword lands, but one the profile does not back earns nothing', async () => {
    const comparison = await flush(repos.jd.compare('res_base', 'job_stripe'));
    const generation = await flush(
      repos.generations.start({
        kind: 'resume',
        jdId: comparison.jdId,
        jobId: 'job_stripe',
        baseResumeId: 'res_base',
        tailor: {
          sourceResumeId: 'res_base',
          baselineScore: comparison.score,
          sourcePages: comparison.pageCount,
          added: ['Fintech'],
          skipped: [],
        },
      }),
    );
    expect(generation.tailor?.added).toHaveLength(1);

    // The ticker only runs while someone is watching, as the progress screen does.
    repos.generations.subscribe(generation.id, () => undefined);
    await jest.advanceTimersByTimeAsync(GENERATION_TICK_MS * 12);

    const done = store.state.generations.find((item) => item.id === generation.id);
    expect(done?.status).toBe('ready');
    const resumeId = done?.resumeId ?? '';
    const resume = store.state.resumes.find((item) => item.id === resumeId);
    // G16: the profile does not back Fintech, so writing it in moves nothing, and the report says so.
    expect(resume?.atsScore).toBe(comparison.score);
    expect(store.state.atsScores[resumeId]?.report?.unbacked).toContain('Fintech');
    expect(resume?.pageCount).toBe(2);
    const body = store.state.contents[resumeId];
    expect(body?.kind === 'resume' && body.skills).toContain('Fintech');
  });

  it('refuses a scan with a reason the sheet can recognise (TAILOR 01c)', async () => {
    await expect(
      flush(repos.resumes.importFromFile({ name: 'Resume_scan.pdf', uri: 'file://x' })),
    ).rejects.toMatchObject({ code: 'UNREADABLE_FILE' });
  });
});
