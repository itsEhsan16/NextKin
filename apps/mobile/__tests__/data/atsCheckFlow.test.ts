import { jdFromDraft, scoreContent } from '@nextkin/shared/repos/scoring';

import { atsCheckFrom, buildResumeContent, useMockModeStore } from '@/data/mock';
import { atsCheckTitle, type JdDraft, type Resume } from '@/data/models';
import { createMockRepos, GENERATION_TICK_MS, type Repos } from '@/data/repos';
import { createMockStore, type MockStore } from '@/data/repos/state';

/** Resolves a repo promise by flushing mock latency under fake timers. */
async function flush<T>(promise: Promise<T>): Promise<T> {
  const [value] = await Promise.all([promise, jest.advanceTimersByTimeAsync(3000)]);
  return value;
}

const RESUME = { id: 'res_up', title: 'George_Smith_CV', pageCount: 3 } as Resume;

const draft = (patch: Partial<JdDraft> = {}): JdDraft =>
  ({
    id: 'jd_x',
    source: 'paste',
    createdAt: '2026-10-04T00:00:00.000Z',
    title: 'Senior Product Designer',
    company: 'Acme Pay',
    requiredSkills: ['Figma', 'Merchant onboarding'],
    preferredSkills: ['Usability testing'],
    responsibilities: [],
    tools: [],
    rawText: '',
    ...patch,
  }) as JdDraft;

describe('ATS check result (ATS 03, V2 §7.8)', () => {
  const store = createMockStore();
  const content = buildResumeContent({ resumeId: 'res_up', versionId: 'ver_up' });
  /** A check reads the document on its own terms (C-10): its own dated roles are the yardstick. */
  const check = (jd: JdDraft) => {
    const result = scoreContent(store.state, content, jdFromDraft(jd), { yardstick: 'document' });
    return { result, check: atsCheckFrom({ result, resume: RESUME, draft: jd }) };
  };

  it('reads the number, the missing skills and the fixes off one engine run', () => {
    const { result, check: verdict } = check(draft());
    expect(verdict?.score).toBe(result.score?.total);
    expect(verdict?.band).toBe(result.score?.band);
    // Figma is on George's resume; merchant onboarding is nowhere in it.
    expect(verdict?.missing).toContain('Merchant onboarding');
    expect(verdict?.missing).not.toContain('Figma');
    // Length is advisory (lint) and never part of the score: three pages raise it anyway.
    expect(verdict?.fixes.map((fix) => fix.key)).toContain('length');
    expect(verdict?.company).toBe('Acme Pay');
  });

  it('has no result for a job that names no skill the engines can read (D-15)', () => {
    expect(check(draft({ requiredSkills: [], preferredSkills: [] })).check).toBeUndefined();
  });

  it('says "this job" when the description names no company', () => {
    expect(atsCheckTitle({ band: 'good' })).toBe('Good for this job');
  });
});

describe('running an ATS check', () => {
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

  async function startCheck() {
    const { resume } = await flush(
      repos.resumes.importFromFile({ name: 'George_Smith_CV.pdf', uri: 'file://cv' }),
    );
    const extracted = await flush(repos.jd.extract({ source: 'job', jobId: 'job_stripe' }));
    const generation = await flush(
      repos.generations.start({
        kind: 'ats_check',
        sourceResumeId: resume.id,
        jdId: extracted.id,
        jobId: 'job_stripe',
      }),
    );
    return { resume, generation };
  }

  it('keeps the result on the run, and the document’s panel says the same number', async () => {
    const { resume, generation } = await startCheck();
    const seen: number[] = [];
    repos.generations.subscribe(generation.id, (next) => {
      if (next.atsCheck) seen.push(next.atsCheck.score);
    });
    await jest.advanceTimersByTimeAsync(GENERATION_TICK_MS * 12);

    const done = store.state.generations.find((item) => item.id === generation.id);
    expect(done?.status).toBe('ready');
    const score = done?.atsCheck?.score;
    expect(score).toBeDefined();
    // The watcher hears the stored run, result included.
    expect(seen).toEqual([score]);
    expect(store.state.atsScores[resume.id]?.total).toBe(score);
  });

  it('cancels a run, hands the check back and keeps the checked file', async () => {
    const before = store.state.subscription.usage.atsChecksUsed ?? 0;
    const { resume, generation } = await startCheck();
    expect(store.state.subscription.usage.atsChecksUsed).toBe(before + 1);

    const cancelled = await flush(repos.generations.cancel(generation.id));
    expect(cancelled.status).toBe('failed');
    expect(cancelled.error).toBe('Cancelled');
    expect(store.state.subscription.usage.atsChecksUsed).toBe(before);
    // A check reads a document that already exists; cancelling must not delete it.
    expect(store.state.resumes.some((item) => item.id === resume.id)).toBe(true);
  });
});
