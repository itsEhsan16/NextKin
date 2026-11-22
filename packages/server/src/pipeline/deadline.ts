import { AsyncLocalStorage } from 'node:async_hooks';

import { StageError } from './stages';

/**
 * A run's deadline (owner, 2026-11-22). The runner starts each stage inside `withDeadline`, and the
 * AI gateway and the page-fit compile loop read the signal from here, so a run past its timeout
 * stops its own work instead of carrying on after the sweep has failed it. Kept in async context so
 * no stage has to thread it through by hand.
 */
const store = new AsyncLocalStorage<AbortSignal>();

export const DEADLINE_MESSAGE = 'This took too long and was stopped. Try again.';

export function withDeadline<T>(deadline: Date | null, fn: () => Promise<T>): Promise<T> {
  if (!deadline) return fn();
  const ms = deadline.getTime() - Date.now();
  const signal = ms <= 0 ? AbortSignal.abort() : AbortSignal.timeout(ms);
  return store.run(signal, fn);
}

/** The current run's signal, if the caller runs inside a stage that has one. */
export function currentDeadline(): AbortSignal | undefined {
  return store.getStore();
}

/** Throws the run's permanent timeout when its deadline has passed. */
export function checkDeadline(): void {
  if (store.getStore()?.aborted) throw new StageError('timed_out', DEADLINE_MESSAGE);
}
