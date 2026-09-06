import { ACTIVE_GENERATION_ID, GENERATING_RESUME_ID, useMockModeStore } from '@/data/mock';
import type { Generation } from '@/data/models';
import { createMockRepos, GENERATION_TICK_MS, type Repos } from '@/data/repos';
import { createMockStore, type MockStore } from '@/data/repos/state';

/**
 * V2 §7.6 — the generation lifecycle end to end.
 *
 * Every test builds its own `createMockRepos(createMockStore())` rather than resetting the
 * singleton: a ticker is a `setInterval` closed over one repo instance, and `resetMockRepos()`
 * would re-seed the state underneath a still-running interval (see `generationsRepo`'s header).
 */

/** Resolves a repo promise by flushing mock latency under fake timers. */
async function flush<T>(promise: Promise<T>): Promise<T> {
  const [value] = await Promise.all([promise, jest.advanceTimersByTimeAsync(3000)]);
  return value;
}

describe('GenerationsRepo (mock)', () => {
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

  describe('start()', () => {
    it('queues the run and the document it will fill, newest first', async () => {
      const generation = await flush(
        repos.generations.start({ kind: 'resume', jobId: 'job_stripe' }),
      );

      expect(generation.status).toBe('queued');
      expect(generation.progress).toBe(0);
      expect(store.state.generations[0]?.id).toBe(generation.id);

      const resumeId = generation.resumeId;
      expect(resumeId).toBeDefined();
      const resume = store.state.resumes.find((item) => item.id === resumeId);
      // "Stripe — Senior Product Designer": the shape the Resumes library already lists in.
      expect(resume?.title).toBe('Stripe — Senior Product Designer');
      expect(resume?.status).toBe('queued');
      expect(resume?.docType).toBe('resume');
      expect(resume?.linkedJobId).toBe('job_stripe');
      expect(resume?.versionCount).toBe(1);
      expect(store.state.resumes[0]?.id).toBe(resumeId);
    });

    it('creates no document for an ATS check — it re-reads the one it was pointed at', async () => {
      const generation = await flush(
        repos.generations.start({ kind: 'ats_check', sourceResumeId: 'res_base' }),
      );

      expect(generation.resumeId).toBe('res_base');
      expect(store.state.resumes).toHaveLength(store.state.resumes.length);
      expect(store.state.resumes.filter((r) => r.status === 'queued')).toHaveLength(0);
    });

    it('moves the §13.3 meter that belongs to the kind, and no other', async () => {
      const before = { ...store.state.subscription.usage };

      await flush(repos.generations.start({ kind: 'resume', jobId: 'job_stripe' }));
      expect(store.state.subscription.usage.generationsUsed).toBe(before.generationsUsed + 1);
      expect(store.state.subscription.usage.resumesUsed).toBe(before.resumesUsed + 1);
      expect(store.state.subscription.usage.coverLettersUsed).toBe(before.coverLettersUsed);

      await flush(repos.generations.start({ kind: 'cover_letter', jdId: 'jd_stripe' }));
      expect(store.state.subscription.usage.coverLettersUsed).toBe(before.coverLettersUsed + 1);

      // The §13.3 meters the fixture seeds part-spent. Deltas, like the rows above: an absolute
      // here only held while these fields were undefined and the first run started the count.
      await flush(repos.generations.start({ kind: 'ats_check', sourceResumeId: 'res_base' }));
      expect(store.state.subscription.usage.atsChecksUsed).toBe((before.atsChecksUsed ?? 0) + 1);

      await flush(repos.generations.start({ kind: 'interview', sourceResumeId: 'res_base' }));
      expect(store.state.subscription.usage.interviewSetsUsed).toBe(
        (before.interviewSetsUsed ?? 0) + 1,
      );
    });

    it('never throws on a spent quota — V2 §13.5 gates in the UI before the work begins', async () => {
      store.state.subscription.usage.generationsUsed = 99;
      const generation = await flush(repos.generations.start({ kind: 'resume' }));
      expect(generation.status).toBe('queued');
    });

    it('records the run in History and bumps the dashboard counter', async () => {
      const entries = store.state.activity.length;
      const counted = store.state.dashboardStats.activitiesCount;

      await flush(repos.generations.start({ kind: 'resume', jobId: 'job_stripe' }));

      expect(store.state.activity).toHaveLength(entries + 1);
      expect(store.state.dashboardStats.activitiesCount).toBe(counted + 1);
      expect(store.state.activity[0]?.kind).toBe('generation');
      expect(store.state.activity[0]?.title).toContain('Stripe — Senior Product Designer');
    });
  });

  describe('subscribe()', () => {
    it('ticks a JD-backed run to ready with a body and a score read off the JD', async () => {
      const generation = await flush(
        repos.generations.start({ kind: 'resume', jdId: 'jd_stripe', jobId: 'job_stripe' }),
      );
      const resumeId = generation.resumeId ?? '';

      const seen: Generation[] = [];
      repos.generations.subscribe(generation.id, (next) => seen.push(next));
      // 0 → 1 in steps of 0.15: seven ticks, plus one to prove the ticker stopped.
      await jest.advanceTimersByTimeAsync(GENERATION_TICK_MS * 8);

      expect(seen.at(-1)?.status).toBe('ready');
      expect(seen.filter((run) => run.status === 'ready')).toHaveLength(1);

      const content = store.state.contents[resumeId];
      expect(content).toBeDefined();
      expect(content?.kind).toBe('resume');

      const score = store.state.atsScores[resumeId];
      // Scored from the JD, not from the fixed fallback the no-JD path uses.
      expect(score?.total).toBeDefined();
      expect(score?.total).not.toBe(83);
      // "Fintech" is preferred on the JD and nothing in the profile backs it: V2 §7.8 shows it
      // as a gap and never offers it as text to paste in.
      const keywords = score?.sections.find((section) => section.key === 'keywords');
      const gap = keywords?.items.find((item) => item.label.includes('Fintech'));
      expect(gap?.supported).toBe(false);
      expect(gap?.fixable).toBe(false);

      const resume = store.state.resumes.find((item) => item.id === resumeId);
      expect(resume?.status).toBe('ready');
      expect(resume?.atsScore).toBe(score?.total);
      expect(resume?.thumbnailUrl).toBeDefined();
      expect(resume?.validation).toBeDefined();
    });

    it('lands the seeded run with no JD on exactly 83, the score Home renders', async () => {
      // `gen_active` carries no `jdId`, and HomeScreen.test.tsx drives it to completion.
      repos.generations.subscribe(ACTIVE_GENERATION_ID, () => {});
      await jest.advanceTimersByTimeAsync(GENERATION_TICK_MS * 5);

      expect(store.state.atsScores[GENERATING_RESUME_ID]?.total).toBe(83);
      const resume = store.state.resumes.find((item) => item.id === GENERATING_RESUME_ID);
      expect(resume?.status).toBe('ready');
      expect(resume?.atsScore).toBe(83);
      expect(store.state.contents[GENERATING_RESUME_ID]).toBeDefined();
    });

    it('fails on the first tick in error mode', async () => {
      useMockModeStore.setState({ mode: 'error' });
      const seen: Generation[] = [];
      repos.generations.subscribe(ACTIVE_GENERATION_ID, (next) => seen.push(next));

      await jest.advanceTimersByTimeAsync(GENERATION_TICK_MS);

      expect(seen).toHaveLength(1);
      expect(seen[0]?.status).toBe('failed');
      expect(seen[0]?.error).toBe('Simulated failure');
      const resume = store.state.resumes.find((item) => item.id === GENERATING_RESUME_ID);
      expect(resume?.status).toBe('generating');
    });
  });

  describe('retry()', () => {
    it('clears the error and puts the run and its document back in the queue', async () => {
      const retried = await flush(repos.generations.retry('gen_failed_1'));

      expect(retried.status).toBe('queued');
      expect(retried.progress).toBe(0);
      expect(retried.error).toBeUndefined();
      expect('error' in retried).toBe(false);
    });

    it('re-queues the linked document too', async () => {
      const generation = await flush(
        repos.generations.start({ kind: 'resume', jdId: 'jd_stripe' }),
      );
      store.state.generations = store.state.generations.map((item) =>
        item.id === generation.id ? { ...item, status: 'failed', error: 'boom' } : item,
      );

      await flush(repos.generations.retry(generation.id));
      const resume = store.state.resumes.find((item) => item.id === generation.resumeId);
      expect(resume?.status).toBe('queued');
    });
  });

  describe('get() and list()', () => {
    it('returns one run and rejects for an unknown id', async () => {
      expect((await flush(repos.generations.get(ACTIVE_GENERATION_ID))).kind).toBe('resume');
      await expect(flush(repos.generations.get('nope'))).rejects.toThrow(
        'Generation "nope" not found',
      );
    });

    it('lists every run, newest first, and nothing in empty mode', async () => {
      const list = await flush(repos.generations.list());
      const started = list.map((run) => run.startedAt);
      expect(started).toEqual([...started].sort((a, b) => b.localeCompare(a)));

      useMockModeStore.setState({ mode: 'empty' });
      expect(await flush(repos.generations.list())).toEqual([]);
    });
  });
});
