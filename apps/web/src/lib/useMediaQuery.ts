'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether a media query matches now, following it as the window changes.
 *
 * The server has no window, so it answers `false`; ask the question whose `false` is the wide,
 * desktop answer (`(width < 80rem)`, not `(width >= 80rem)`), so the server render and the
 * common case agree. CSS should still carry anything visible on first paint: this only settles
 * after hydration.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
