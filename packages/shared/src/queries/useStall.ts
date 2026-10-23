import { useEffect, useState } from 'react';

/** How long a wait runs before the screen says it is taking longer than usual (toreview §131). */
export const STALL_SLOW_MS = 60_000;
/** How long a wait runs before the screen gives up on it and offers a retry (toreview §131). */
export const STALL_FAIL_MS = 300_000;

/** Where a wait stands: on time, slower than usual, or stalled and worth retrying. */
export type Stall = 'ok' | 'slow' | 'stalled';

/**
 * Watches a wait that has no end of its own (a reading, a run, a reply): while `active` holds, it
 * turns `slow` after `slowMs` and `stalled` after `failMs`. Any change of `progress` (a new stage,
 * a tick) restarts the clock, so only a wait that has stopped moving is ever called stalled.
 */
export function useStall(
  active: boolean,
  progress: unknown,
  { slowMs = STALL_SLOW_MS, failMs = STALL_FAIL_MS }: { slowMs?: number; failMs?: number } = {},
): Stall {
  const [stall, setStall] = useState<Stall>('ok');
  useEffect(() => {
    setStall('ok');
    if (!active) return undefined;
    const slow = setTimeout(() => setStall('slow'), slowMs);
    const fail = setTimeout(() => setStall('stalled'), failMs);
    return () => {
      clearTimeout(slow);
      clearTimeout(fail);
    };
  }, [active, progress, slowMs, failMs]);
  return active ? stall : 'ok';
}
