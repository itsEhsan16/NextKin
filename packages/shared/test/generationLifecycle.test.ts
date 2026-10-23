import { describe, expect, it } from 'vitest';
import {
  GENERATION_STEPS,
  generationStepIndex,
  isGenerationTerminal,
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
