'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { motion } from '@/theme/tokens';

type Router = ReturnType<typeof useRouter>;

/**
 * How long the guard holds. Tests set it to 0 (jest.setup.ts): a test clicks one control after
 * another far faster than a person, and each click there means a separate visit.
 */
export const navigationGate = { windowMs: motion.navGuard as number };

/** When the last guarded move began. Module-wide: two buttons clicked together are one click too. */
let lastMove = Number.NEGATIVE_INFINITY;

/**
 * Lets one navigation through per route change (§196, after mobile). A double click on a
 * Continue button, a notification or a flow step used to push the page twice, so Back landed on
 * a duplicate. Moves inside `motion.navGuard` of the last one are dropped.
 */
export function allowNavigation(now: number = Date.now()): boolean {
  if (now - lastMove < navigationGate.windowMs) return false;
  lastMove = now;
  return true;
}

/** For tests: forget the last move. */
export function resetNavigationGuard(): void {
  lastMove = Number.NEGATIVE_INFINITY;
}

/**
 * `useRouter()` whose `push` ignores a repeat inside the guard window. Use it where a click opens
 * a page. `replace`, `back` and `refresh` pass through: flows replace themselves programmatically
 * right after a push, and that must land.
 */
export function useGuardedRouter(): Router {
  const router = useRouter();
  return useMemo<Router>(
    () => ({
      ...router,
      push: ((...args: Parameters<Router['push']>) => {
        if (allowNavigation()) router.push(...args);
      }) as Router['push'],
    }),
    [router],
  );
}
