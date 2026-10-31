import { describe, expect, it } from 'vitest';
import {
  GENERATION_STEPS,
  generationStepIndex,
  isGenerationTerminal,
  unfinishedRuns,
  type Generation,
  type GenerationStatus,
} from '../src/models/generation';

/**
 * The generation lifecycle is part of the contract the backend's SSE stream must honour
 * (ImBackendImplementationPlan §2.3): spec §7.6's canonical order, with `failed` reachable from
 * any stage. If this changes, the server's pipeline runner and both apps change with it.
 */
describe('generation lifecycle contract', () => {
  it('steps run in spec §7.6 order', () => {
    expect(GENERATION_STEPS.map((step) => step.status)).toEqual([
      'queued',
      'generating',
      'validating',
      'scoring',
      'ready',
    ]);
  });

  it('only ready and failed are terminal', () => {
    const all: GenerationStatus[] = ['queued', 'generating', 'validating', 'scoring', 'ready', 'failed'];
    expect(all.filter(isGenerationTerminal)).toEqual(['ready', 'failed']);
  });

  it('failed sits outside the step sequence', () => {
    expect(generationStepIndex('failed')).toBe(-1);
    expect(generationStepIndex('scoring')).toBe(3);
  });
});

describe('unfinishedRuns', () => {
  const NOW = new Date('2026-11-01T12:00:00.000Z');
  const run = (id: string, over: Partial<Generation>): Generation => ({
    id,
    kind: 'resume',
    status: 'failed',
    progress: 0.3,
    startedAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:05:00.000Z',
    error: 'Stopped.',
    ...over,
  });
  const ids = (runs: Generation[]) => unfinishedRuns(runs, NOW).map((item) => item.id);

  it('lists what is working first, then the failures, and never a finished run', () => {
    expect(
      ids([
        run('failed', { jobId: 'job_1' }),
        run('working', { status: 'scoring', jobId: 'job_2' }),
        run('done', { status: 'ready', jobId: 'job_3' }),
      ]),
    ).toEqual(['working', 'failed']);
  });

  it('leaves out a run the person cancelled', () => {
    expect(ids([run('stopped', { cancelled: true })])).toEqual([]);
  });

  it('lets a failure go after a week', () => {
    expect(ids([run('old', { updatedAt: '2026-10-25T11:59:00.000Z' })])).toEqual([]);
    expect(ids([run('recent', { updatedAt: '2026-10-25T12:01:00.000Z' })])).toEqual(['recent']);
  });

  it('lets a failure go once a later run of that kind went after the same job', () => {
    const later = { startedAt: '2026-11-01T11:00:00.000Z', jobId: 'job_1' };
    expect(
      ids([run('second', { ...later, status: 'ready' }), run('first', { jobId: 'job_1' })]),
    ).toEqual([]);
  });

  it('keeps a failure when the later run was for something else', () => {
    const later = { startedAt: '2026-11-01T11:00:00.000Z', status: 'ready' as const };
    expect(
      ids([
        run('other job', { ...later, jobId: 'job_2' }),
        run('other kind', { ...later, jobId: 'job_1', kind: 'cover_letter' }),
        run('first', { jobId: 'job_1' }),
      ]),
    ).toEqual(['first']);
  });

  it('never treats two runs with no target as the same work', () => {
    expect(
      ids([run('second', { startedAt: '2026-11-01T11:00:00.000Z' }), run('first', {})]),
    ).toEqual(['second', 'first']);
  });
});
