import { getMockMode, newId, simulate } from '@/data/mock';
import type { Generation, GenerationStatus, JdDraft, Job, Resume } from '@/data/models';
import { isGenerationTerminal } from '@/data/models';

import { completeGeneration, GENERATION_ACTIVITY_KIND } from './generationCompletion';
import { appendStartActivity, bumpGenerationUsage, createGenerationShell } from './generationStart';
import { clone, findOrThrow, type MockStore } from './state';
import type { GenerationsRepo, Unsubscribe } from './types';

/**
 * NextKin V2 spec §7.6 — the generation pipeline's mock engine. `start` creates the run and the
 * document it fills (./generationStart), a ticker advances it, and `completeGeneration`
 * (./generationCompletion) finishes the document when it lands on 'ready'.
 *
 * TESTING NOTE — the tickers below are `setInterval`s held in a Map on one repo instance, and
 * `resetMockRepos()` swaps the state out from under them without stopping them: an interval
 * started before the reset keeps ticking and starts advancing the freshly re-seeded `gen_active`
 * all over again. So build a fresh `createMockRepos()` per test and clear timers on teardown
 * (`jest.clearAllTimers()`); never call `resetMockRepos()` while a run is in flight.
 */

/** Live-progress cadence: one tick every 1.2s, ~4 ticks from the fixture's 0.45 to ready. */
export const GENERATION_TICK_MS = 1200;
export const GENERATION_PROGRESS_STEP = 0.15;

export function statusForProgress(progress: number): GenerationStatus {
  if (progress >= 1) return 'ready';
  if (progress >= 0.75) return 'scoring';
  if (progress >= 0.5) return 'validating';
  if (progress > 0) return 'generating';
  return 'queued';
}

const byStartedDesc = (a: Generation, b: Generation): number =>
  b.startedAt.localeCompare(a.startedAt);

type Ticker = { timer: ReturnType<typeof setInterval>; listeners: Set<(g: Generation) => void> };

/**
 * History records a run at both ends. A failure is the end nothing used to write, so a run that
 * died left a "Generating…" entry and then silence; the entry points at the run's own screen,
 * where the retry is.
 */
function appendFailureActivity(store: MockStore, generation: Generation, now: string): void {
  const resume = generation.resumeId
    ? store.state.resumes.find((item) => item.id === generation.resumeId)
    : undefined;
  const subject = resume?.title ?? generation.title ?? 'that run';
  store.state.activity = [
    {
      id: newId('act'),
      kind: GENERATION_ACTIVITY_KIND[generation.kind],
      title: `**${subject}** couldn't be generated`,
      createdAt: now,
      deepLink: `/generations/${generation.id}`,
      ...(generation.error ? { detail: generation.error } : {}),
      ...(resume ? { resumeId: resume.id } : {}),
      ...(generation.jobId ? { jobId: generation.jobId } : {}),
    },
    ...store.state.activity,
  ];
  store.state.dashboardStats = {
    ...store.state.dashboardStats,
    activitiesCount: store.state.dashboardStats.activitiesCount + 1,
  };
}

export function createMockGenerationsRepo(store: MockStore): GenerationsRepo {
  const tickers = new Map<string, Ticker>();

  const startTicker = (id: string): Ticker => {
    const ticker: Ticker = {
      listeners: new Set(),
      timer: setInterval(() => tick(id), GENERATION_TICK_MS),
    };
    tickers.set(id, ticker);
    return ticker;
  };

  const stopTicker = (id: string): void => {
    const ticker = tickers.get(id);
    if (!ticker) return;
    clearInterval(ticker.timer);
    tickers.delete(id);
  };

  const tick = (id: string): void => {
    const current = store.state.generations.find((generation) => generation.id === id);
    const ticker = tickers.get(id);
    if (!current || !ticker) return stopTicker(id);

    const now = new Date().toISOString();
    const next: Generation =
      getMockMode() === 'error'
        ? { ...current, status: 'failed', updatedAt: now, error: 'Simulated failure' }
        : (() => {
            const progress = Math.min(
              1,
              Math.round((current.progress + GENERATION_PROGRESS_STEP) * 100) / 100,
            );
            return { ...current, progress, status: statusForProgress(progress), updatedAt: now };
          })();

    store.state.generations = store.state.generations.map((generation) =>
      generation.id === id ? next : generation,
    );
    if (next.status === 'ready') completeGeneration(store, next);
    if (next.status === 'failed') appendFailureActivity(store, next, now);
    if (isGenerationTerminal(next.status)) stopTicker(id);
    ticker.listeners.forEach((listener) => listener(clone(next)));
  };

  const findDraft = (id: string | undefined): JdDraft | undefined =>
    id ? store.state.jdDrafts.find((draft) => draft.id === id) : undefined;

  const findJob = (id: string | undefined): Job | undefined =>
    id ? store.state.jobs.find((job) => job.id === id) : undefined;

  return {
    getActive: () =>
      simulate(
        () => {
          const active = store.state.generations.find((g) => !isGenerationTerminal(g.status));
          return active ? clone(active) : null;
        },
        { empty: () => null },
      ),

    get: (id) => simulate(() => clone(findOrThrow(store.state.generations, id, 'Generation'))),

    list: () =>
      simulate(() => clone([...store.state.generations].sort(byStartedDesc)), { empty: () => [] }),

    start: (input) =>
      simulate(() => {
        const now = new Date().toISOString();
        const draft = findDraft(input.jdId);
        const jobId = input.jobId ?? draft?.jobId;
        const job = findJob(jobId);
        // §7.8's check and §7.15's questions are *about* a document that already exists; every
        // other kind creates the shell it is going to fill.
        const source = input.sourceResumeId
          ? findOrThrow(store.state.resumes, input.sourceResumeId, 'Resume')
          : undefined;
        const reuses = input.kind === 'ats_check' || input.kind === 'interview';
        const resume: Resume | undefined = reuses
          ? source
          : createGenerationShell(store, input, draft, job, now);

        const generation: Generation = {
          id: newId('gen'),
          kind: input.kind,
          status: 'queued',
          progress: 0,
          startedAt: now,
          updatedAt: now,
          // Spread rather than assign undefined: the store round-trips through JSON, which
          // drops undefined-valued keys, so an absent link has to be an absent key.
          ...(resume ? { resumeId: resume.id } : {}),
          ...(input.jdId ? { jdId: input.jdId } : {}),
          ...(jobId ? { jobId } : {}),
          ...(input.tone ? { tone: input.tone } : {}),
          // A standalone interview set has no resume and no JD; the role title travels here.
          ...(input.title?.trim() ? { title: input.title.trim() } : {}),
        };

        // Newest first: `getActive` and History both read this list in declaration order.
        store.state.generations = [generation, ...store.state.generations];
        bumpGenerationUsage(store, input.kind);
        appendStartActivity(store, input, resume, jobId, now);
        return clone(generation);
      }),

    retry: (id) =>
      simulate(() => {
        const current = findOrThrow(store.state.generations, id, 'Generation');
        const now = new Date().toISOString();
        const next: Generation = { ...current, status: 'queued', progress: 0, updatedAt: now };
        // Deleted rather than set to undefined: a JSON-safe store has no undefined values, and
        // the failure banner reads "is there an `error` key", not "is it truthy".
        delete next.error;

        store.state.generations = store.state.generations.map((generation) =>
          generation.id === id ? next : generation,
        );
        const resumeId = next.resumeId;
        if (resumeId) {
          store.state.resumes = store.state.resumes.map((resume) =>
            resume.id === resumeId ? { ...resume, status: 'queued', updatedAt: now } : resume,
          );
        }
        // No ticker is started here: one exists only while something is subscribed, so the
        // progress screen's next `subscribe()` restarts the run.
        return clone(next);
      }),

    subscribe: (id, onChange): Unsubscribe => {
      const current = store.state.generations.find((generation) => generation.id === id);
      if (!current || isGenerationTerminal(current.status)) return () => {};

      const ticker = tickers.get(id) ?? startTicker(id);
      ticker.listeners.add(onChange);

      return () => {
        ticker.listeners.delete(onChange);
        if (ticker.listeners.size === 0) stopTicker(id);
      };
    },
  };
}
