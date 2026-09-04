import { getMockMode, simulate } from '@/data/mock';
import type { AtsScore, Generation, GenerationStatus } from '@/data/models';
import { atsBandFor, isGenerationTerminal } from '@/data/models';

import { clone, type MockStore } from './state';
import type { GenerationsRepo, Unsubscribe } from './types';

/** Live-progress cadence: one tick every 1.2s, ~4 ticks from the fixture's 0.45 to ready. */
export const GENERATION_TICK_MS = 1200;
export const GENERATION_PROGRESS_STEP = 0.15;

/** Completed mock generations land on this score so the reveal is consistent. */
const COMPLETED_SCORE = 83;

export function statusForProgress(progress: number): GenerationStatus {
  if (progress >= 1) return 'ready';
  if (progress >= 0.75) return 'scoring';
  if (progress >= 0.5) return 'validating';
  if (progress > 0) return 'generating';
  return 'queued';
}

const completedScore = (): AtsScore => ({
  total: COMPLETED_SCORE,
  band: atsBandFor(COMPLETED_SCORE),
  summary: 'Solid foundation — a few fixes will push this into the green.',
  sections: [
    {
      key: 'content',
      label: 'Content',
      items: [
        { id: 'quantified', label: 'Quantified achievements in 3+ bullets', passed: true },
        { id: 'verbs', label: 'Action verbs open every bullet', passed: true },
        { id: 'summary', label: 'Summary under 60 words', passed: true },
      ],
    },
    {
      key: 'format',
      label: 'Format',
      items: [
        { id: 'column', label: 'Single column — parser safe', passed: true },
        { id: 'headings', label: 'Standard section headings', passed: true },
      ],
    },
    {
      key: 'keywords',
      label: 'Keywords',
      items: [
        { id: 'kw_1', label: '"creative tools" appears 3 times', passed: true },
        { id: 'kw_miss_0', label: 'Missing: "illustration"', passed: false, fixable: true },
        { id: 'kw_miss_1', label: 'Missing: "brand"', passed: false, fixable: true },
      ],
    },
  ],
});

type Ticker = { timer: ReturnType<typeof setInterval>; listeners: Set<(g: Generation) => void> };

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

  /**
   * A finished generation becomes the newest ready resume, so it is what Home's "Your Resume
   * Progress" card shows. It therefore has to arrive shaped like any other ready resume — with a
   * thumbnail, a completeness fraction and the three validation flags. Setting only the status and
   * the score left the card as an empty shell: blank thumbnail, unfilled meter, and no checks row
   * at all, none of which the artboard has a state for.
   *
   * The three values are derived from the score rather than invented, so they cannot drift from
   * the panel the user sees when they open it.
   */
  const markResumeReady = (resumeId: string | undefined): void => {
    if (!resumeId) return;
    const score = completedScore();
    const items = score.sections.flatMap((section) => section.items);
    const allPassed = (key: string) =>
      score.sections.find((section) => section.key === key)?.items.every((item) => item.passed) ??
      false;

    store.state.resumes = store.state.resumes.map((resume) =>
      resume.id === resumeId
        ? {
            ...resume,
            status: 'ready',
            atsScore: COMPLETED_SCORE,
            updatedAt: new Date().toISOString(),
            thumbnailUrl: resume.thumbnailUrl ?? 'asset:resume-thumb',
            completeness: items.filter((item) => item.passed).length / items.length,
            validation: {
              timelineValid: allPassed('content'),
              atsOptimized: allPassed('format'),
              // Two keyword misses are the whole point of this score — the card must say so.
              jdMatched: allPassed('keywords'),
            },
          }
        : resume,
    );
    store.state.atsScores[resumeId] = score;
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
    if (next.status === 'ready') markResumeReady(next.resumeId);
    if (isGenerationTerminal(next.status)) stopTicker(id);
    ticker.listeners.forEach((listener) => listener(clone(next)));
  };

  return {
    getActive: () =>
      simulate(
        () => {
          const active = store.state.generations.find((g) => !isGenerationTerminal(g.status));
          return active ? clone(active) : null;
        },
        { empty: () => null },
      ),

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
