import { useEffect, useState } from 'react';
import {
  FadeInDown,
  useSharedValue,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { motion } from '@/theme';

type Entering = ReturnType<typeof FadeInDown.delay> | EntryExitAnimationFunction | undefined;

/** `card` between page sections and cards (40 ms); `row` between rows in a sheet (60 ms). */
export type StaggerStep = 'card' | 'row';

/**
 * The entrance for loaded content: sections fade up in turn, `stagger[step]` apart, capped at
 * `stagger.maxItems` — but only in the commit where loaded data replaces a skeleton.
 *
 * Content that is already there when the screen mounts (a form, a cached list) slides in whole
 * with the push and does not stagger on top of it (owner, 2026-10-05). And once revealed, items
 * that mount later — a filter or a search changing which cards show — appear without replaying
 * the entrance.
 *
 * Usage: `const enter = useRevealStagger(!query.isPending)`, then `entering={enter(i)}`. Call it
 * above any early return.
 */
export function useRevealStagger(ready: boolean, step: StaggerStep = 'card') {
  const reduced = useReducedMotion();
  const [readyAtMount] = useState(ready);
  // Flipped right after the reveal commits, so only items mounting IN that commit get the
  // entrance. A shared value rather than state: an effect may write it without a re-render, and
  // the render reads it synchronously.
  const revealed = useSharedValue(readyAtMount);
  useEffect(() => {
    if (ready) revealed.set(true);
  }, [ready, revealed]);

  const gap = motion.stagger[step];
  return (index: number): Entering =>
    reduced || readyAtMount || revealed.get()
      ? undefined
      : FadeInDown.delay(Math.min(index, motion.stagger.maxItems) * gap).duration(
          motion.durations.base,
        );
}
