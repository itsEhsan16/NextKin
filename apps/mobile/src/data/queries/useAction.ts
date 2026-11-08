import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * A one-shot action with React Query's `mutate(input, { onSuccess, onError })` and `isPending`
 * surface, for the signed-out screens, which render above any query client. A second call while one
 * is in flight is dropped.
 */

type Callbacks<R> = { onSuccess?: (result: R) => void; onError?: (error: unknown) => void };

export function useAction<I, R>(run: (input: I) => Promise<R>) {
  const [isPending, setPending] = useState(false);
  const inFlight = useRef(false);
  // The latest `run` without re-creating `mutate`: Clerk's hooks hand back new objects as the
  // attempt moves on, and a callback captured mid-render must still reach the current one.
  const latest = useRef(run);
  useLayoutEffect(() => {
    latest.current = run;
  });
  const mutate = useCallback((input: I, callbacks: Callbacks<R> = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    latest.current(input).then(
      (result) => {
        inFlight.current = false;
        setPending(false);
        callbacks.onSuccess?.(result);
      },
      (error: unknown) => {
        inFlight.current = false;
        setPending(false);
        callbacks.onError?.(error);
      },
    );
  }, []);
  return { mutate, isPending };
}
