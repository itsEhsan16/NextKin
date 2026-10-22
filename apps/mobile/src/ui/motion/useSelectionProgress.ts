import { useEffect } from 'react';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { useReducedMotion, withReducedMotion } from '@/lib';
import { motion } from '@/theme';

/**
 * 0 when off, 1 when on, eased between — the one value a control's selection colours, fills and
 * stacked labels fade on, so a state change reads as a quick fade rather than a snap.
 *
 * Starts at its resting value, so a control that mounts selected shows selected at once.
 */
export function useSelectionProgress(
  on: boolean,
  timing: 'fast' | 'base' = 'fast',
): SharedValue<number> {
  const reduced = useReducedMotion();
  const progress = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    progress.set(withTiming(on ? 1 : 0, withReducedMotion(reduced, motion.timings[timing])));
  }, [on, progress, reduced, timing]);

  return progress;
}
