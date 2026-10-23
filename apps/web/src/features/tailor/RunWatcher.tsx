'use client';

import { useGeneration } from '@nextkin/shared/queries';
import type { Route } from 'next';
import { useEffect, useSyncExternalStore } from 'react';

import { showToast } from '@/lib/toast';

/**
 * "Leave and notify me" made true (toreview §114): a run the user walked away from is watched by
 * the app shell, and when it is ready (or stops) a toast says so with the way back to it. Kept for
 * this tab only; a reload forgets it, and the run itself carries on and lands in Resumes either way.
 */

/** `href` reopens the run's own screen; the two lines are what the toast says either way. */
export type Watched = { runId: string; href: Route; readyMessage: string; failedMessage: string };

let watched: Watched[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function watchRun(run: Watched) {
  if (watched.some((w) => w.runId === run.runId)) return;
  watched = [...watched, run];
  emit();
}

const unwatch = (runId: string) => {
  watched = watched.filter((w) => w.runId !== runId);
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function RunWatcher() {
  const runs = useSyncExternalStore(
    subscribe,
    () => watched,
    () => watched,
  );
  return (
    <>
      {runs.map((run) => (
        <WatchOne key={run.runId} run={run} />
      ))}
    </>
  );
}

function WatchOne({ run }: { run: Watched }) {
  const generation = useGeneration(run.runId);
  const status = generation.data?.status;
  useEffect(() => {
    if (status !== 'ready' && status !== 'failed') return;
    const href = run.href;
    if (status === 'ready') showToast(run.readyMessage, { action: { label: 'Open it', href } });
    else showToast(run.failedMessage, { tone: 'error', action: { label: 'See why', href } });
    unwatch(run.runId);
  }, [status, run]);
  return null;
}
