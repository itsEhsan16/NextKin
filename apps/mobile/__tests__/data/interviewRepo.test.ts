import { useMockModeStore } from '@/data/mock';
import type { Generation } from '@/data/models';
import { createMockRepos, GENERATION_TICK_MS, type Repos } from '@/data/repos';
import { createMockStore, type MockStore } from '@/data/repos/state';

/** Mock latency is timer-driven; this runs the pending timers so the promise settles. */
async function flush<T>(promise: Promise<T>): Promise<T> {
  await jest.runOnlyPendingTimersAsync();
  return promise;
}

/** Drives a run to its terminal state through the ticker, which only advances while subscribed. */
async function finish(repos: Repos, generation: Generation): Promise<Generation> {
  let latest = generation;
  const unsubscribe = repos.generations.subscribe(generation.id, (next) => {
    latest = next;
  });
  for (
    let tick = 0;
    tick < 12 && latest.status !== 'ready' && latest.status !== 'failed';
    tick += 1
  ) {
    await jest.advanceTimersByTimeAsync(GENERATION_TICK_MS);
  }
  unsubscribe();
  return latest;
}

/**
 * Fresh repos per test and cleared timers on teardown — the tickers close over one store and
 * outlive a `resetMockRepos()` (see generationsRepo.ts's header).
 */
describe('InterviewRepo (mock) — V2 §7.15', () => {
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

  it('seeds one set, newest first, and finds it by id', async () => {
    const sets = await flush(repos.interview.list());
    expect(sets.map((set) => set.id)).toEqual(['int_stripe']);
    const set = await flush(repos.interview.get('int_stripe'));
    expect(set.resumeId).toBe('res_2');
  });

  it('writes a set when an interview run finishes, links it to the run, and leaves the resume alone', async () => {
    const before = store.state.resumes.find((resume) => resume.id === 'res_base');
    const started = await flush(
      repos.generations.start({ kind: 'interview', sourceResumeId: 'res_base' }),
    );
    expect(await flush(repos.interview.getByGeneration(started.id))).toBeNull();

    const done = await finish(repos, started);
    expect(done.status).toBe('ready');

    const set = await flush(repos.interview.getByGeneration(started.id));
    expect(set?.resumeId).toBe('res_base');
    expect(set?.source).toBe('resume');
    expect(set?.questions.length).toBeGreaterThanOrEqual(10);
    // Completion must NOT re-stamp the source document: nothing about it changed.
    const after = store.state.resumes.find((resume) => resume.id === 'res_base');
    expect(after?.updatedAt).toBe(before?.updatedAt);
    // And History has a row pointing at the set.
    expect(store.state.activity[0]).toMatchObject({
      kind: 'interview',
      deepLink: `/interview/${set?.id}`,
    });
  });

  it('runs a standalone set through the same pipeline, carrying the role title', async () => {
    const started = await flush(
      repos.generations.start({ kind: 'interview', title: 'Senior Data Engineer' }),
    );
    expect(started.resumeId).toBeUndefined();
    expect(started.title).toBe('Senior Data Engineer');
    const done = await finish(repos, started);
    expect(done.status).toBe('ready');
    const set = await flush(repos.interview.getByGeneration(started.id));
    expect(set?.source).toBe('standalone');
    expect(set?.roleTitle).toBe('Senior Data Engineer');
  });

  it('keeps the earlier set when a resume is regenerated, and links the new one back to it', async () => {
    const started = await flush(
      repos.generations.start({ kind: 'interview', sourceResumeId: 'res_2' }),
    );
    await finish(repos, started);
    const sets = await flush(repos.interview.list());
    expect(sets).toHaveLength(2);
    expect(sets[0]?.regeneratedFromId).toBe('int_stripe');
    expect(sets.some((set) => set.id === 'int_stripe')).toBe(true);
  });

  it('persists a mark on the set rather than on any screen', async () => {
    const marked = await flush(
      repos.interview.markQuestion('int_stripe', 'q_tech_1', 'needs_work'),
    );
    expect(marked.questions.find((question) => question.id === 'q_tech_1')?.mark).toBe(
      'needs_work',
    );
    // A fresh read sees it — that is the acceptance criterion.
    const again = await flush(repos.interview.get('int_stripe'));
    expect(again.questions.find((question) => question.id === 'q_tech_1')?.mark).toBe('needs_work');

    const reset = await flush(repos.interview.resetMarks('int_stripe'));
    expect(reset.questions.every((question) => question.mark === 'unmarked')).toBe(true);
  });

  it('removes a set', async () => {
    await flush(repos.interview.remove('int_stripe'));
    expect(await flush(repos.interview.list())).toEqual([]);
  });
});
