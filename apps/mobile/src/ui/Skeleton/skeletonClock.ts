import {
  cancelAnimation,
  makeMutable,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { motion } from '@/theme';

/**
 * The one pulse every skeleton block breathes with (0 → 1 → 0, a `durations.pulse` half-cycle).
 *
 * Each block used to run its own loop, started whenever it mounted, so blocks that mounted a few
 * frames apart pulsed out of step and a page of them shimmered unevenly — and a page ran dozens of
 * animations to draw one effect. Shared, they move as one, on a single animation.
 *
 * Reference-counted: the loop runs while at least one block is on screen and stops with the last.
 */
let clock: SharedValue<number> | null = null;
let holders = 0;

/** The shared pulse value. Created on first use; reading it never starts the loop. */
export function skeletonClock(): SharedValue<number> {
  clock ??= makeMutable(0);
  return clock;
}

/** Starts the loop for the first holder. Pair every call with `releaseSkeletonClock`. */
export function acquireSkeletonClock(): void {
  holders += 1;
  if (holders === 1) {
    skeletonClock().set(withRepeat(withTiming(1, { duration: motion.durations.pulse }), -1, true));
  }
}

/** Stops the loop once the last holder has gone. */
export function releaseSkeletonClock(): void {
  holders = Math.max(0, holders - 1);
  if (holders === 0 && clock) {
    cancelAnimation(clock);
    clock.set(0);
  }
}

/** How many blocks hold the clock — for tests. */
export const skeletonClockHolders = (): number => holders;
