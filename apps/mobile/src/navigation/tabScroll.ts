import { useEffect } from 'react';

/** Matches the tab route names in `app/(tabs)`. */
export type TabName = 'index' | 'jobs' | 'resumes' | 'profile';

type ScrollToTop = () => void;

/**
 * Re-tapping the focused tab scrolls it back to the top — the standard iOS/Android behaviour.
 *
 * The tab bar drives itself from `useSegments()` and lives outside the navigator, so it cannot
 * reach a screen's list ref through navigation context. A module-level registry is the smallest
 * thing that works: each tab screen registers a handler while mounted, and the bar calls it.
 */
const handlers = new Map<TabName, ScrollToTop>();

/** Registers `fn` for `tab` while the calling screen is mounted. */
export function useTabScrollToTop(tab: TabName, fn: ScrollToTop): void {
  useEffect(() => {
    handlers.set(tab, fn);
    return () => {
      // Only clear our own entry: a screen remounting can register before the old one cleans up.
      if (handlers.get(tab) === fn) handlers.delete(tab);
    };
  }, [fn, tab]);
}

/** Returns false when the tab has nothing scrollable registered, so the caller can skip feedback. */
export function scrollTabToTop(tab: TabName): boolean {
  const fn = handlers.get(tab);
  if (!fn) return false;
  fn();
  return true;
}
