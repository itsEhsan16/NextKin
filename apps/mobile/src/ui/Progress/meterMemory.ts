import { useEffect, useState } from 'react';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { useReducedMotion, withReducedMotion } from '@/lib';
import { motion } from '@/theme';

/**
 * The last value each keyed meter showed, across mounts.
 *
 * A meter counts up from 0 when it mounts. That is right the first time a score appears, and wrong
 * every time after: a search keystroke or a grid/list switch remounts the resume cards, and every
 * score ring swept up from 0 again as if it were new. A meter given a `memoryKey` starts from what
 * it last showed instead, and only animates when the value really changed.
 */
const shown = new Map<string, number>();

/**
 * `meter` (800 ms, decelerating) for a value that settles once; `follow` (linear, one feed beat)
 * for live progress that updates every beat, so consecutive updates join into one glide.
 */
export type MeterTiming = 'meter' | 'follow';

export type MeterOptions = {
  /** Remember what this meter showed (e.g. `ats:<resumeId>`), so a remount does not re-sweep. */
  memoryKey?: string;
  timing?: MeterTiming;
  /** Animate at all; off, the value is set directly. Defaults to true. */
  animated?: boolean;
};

/** A shared value that eases to `target` — from 0, or from the last value its key showed. */
export function useMeterValue(
  target: number,
  { memoryKey, timing = 'meter', animated = true }: MeterOptions = {},
): SharedValue<number> {
  const reduced = useReducedMotion();
  const [start] = useState(() =>
    !animated ? target : memoryKey !== undefined ? (shown.get(memoryKey) ?? 0) : 0,
  );
  const value = useSharedValue(start);

  useEffect(() => {
    value.set(
      animated ? withTiming(target, withReducedMotion(reduced, motion.timings[timing])) : target,
    );
    if (memoryKey !== undefined) shown.set(memoryKey, target);
  }, [animated, memoryKey, reduced, target, timing, value]);

  return value;
}

/** Forget every remembered meter — for tests. */
export function resetMeterMemory(): void {
  shown.clear();
}
