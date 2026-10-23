import type { GenerationInput } from '@nextkin/shared/models';
import { mockStore, repos } from '@nextkin/shared/repos';
import { completeGeneration } from '@nextkin/shared/repos/generationCompletion';

/**
 * Starts a mock run and finishes it at once, as the ticker would after its last step, so a test
 * can open a flow on its result without waiting out the mock's real-time ticks. Call it before the
 * screen mounts: a finished run starts no ticker when the screen subscribes.
 */
export async function finishedRun(input: GenerationInput): Promise<string> {
  const started = await repos.generations.start(input);
  const ready = { ...started, status: 'ready' as const, progress: 1 };
  mockStore.state.generations = mockStore.state.generations.map((g) =>
    g.id === started.id ? ready : g,
  );
  completeGeneration(mockStore, ready);
  return started.id;
}
