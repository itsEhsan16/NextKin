import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { motion } from '@/theme';

type Router = ReturnType<typeof useRouter>;

/**
 * How long the guard holds. Tests set it to 0 (jest.setup.ts): a test taps one control after
 * another far faster than a person, and each tap there means a separate visit.
 */
export const navigationGate = { windowMs: motion.durations.navGuard as number };

/** When the last guarded move began. Module-wide: two buttons tapped together are one tap too. */
let lastMove = Number.NEGATIVE_INFINITY;

/**
 * Lets one navigation through per transition (§196). A double tap, or a tap on a second card
 * while the first push is still sliding in, used to push the screen twice (or two screens), so
 * Back landed on a duplicate. Moves inside `durations.navGuard` of the last one are dropped.
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
 * `useRouter()` whose `push` and `navigate` ignore a repeat inside the guard window. Use it for
 * taps that open screens (cards, rows, menu items). `replace`, `back` and `dismiss` pass through
 * unguarded: flows replace themselves programmatically right after a push, and that must land.
 */
export function useGuardedRouter(): Router {
  const router = useRouter();
  return useMemo<Router>(
    () => ({
      ...router,
      push: ((...args: Parameters<Router['push']>) => {
        if (allowNavigation()) router.push(...args);
      }) as Router['push'],
      navigate: ((...args: Parameters<Router['navigate']>) => {
        if (allowNavigation()) router.navigate(...args);
      }) as Router['navigate'],
    }),
    [router],
  );
}
