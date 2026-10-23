import { useEffect } from 'react';
import {
  cancelAnimation,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { motion } from '@/theme';

export type LoopOptions = {
  /** Holds the loop back before its first cycle, so several loops can run out of step. */
  delay?: number;
  /** Plays each cycle forwards then backwards (0 → 1 → 0) instead of restarting at 0. */
  reverse?: boolean;
};

/**
 * A 0 → 1 clock that repeats every `period` while `active`, for the ambient loops that say "this
 * is working" (a run's art floating, a scan passing, a sparkle's glint). It runs on the UI
 * thread; nothing re-renders while it turns.
 *
 * When the work stops, the clock eases back to rest over `fast` rather than freezing mid-cycle,
 * so whatever it drives settles instead of stopping dead. Under Reduce Motion it never starts.
 */
export function useLoop(
  active: boolean,
  period: number,
  { delay = 0, reverse = false }: LoopOptions = {},
): SharedValue<number> {
  const reduced = useReducedMotion();
  const clock = useSharedValue(0);
  const running = active && !reduced;

  useEffect(() => {
    if (!running) {
      cancelAnimation(clock);
      clock.set(withTiming(0, motion.timings.fast));
      return undefined;
    }
    clock.set(0);
    clock.set(
      withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration: period, easing: motion.easings.linear }),
          -1,
          reverse,
        ),
      ),
    );
    return () => cancelAnimation(clock);
  }, [clock, delay, period, reverse, running]);

  return clock;
}
