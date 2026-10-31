import { useEffect, useRef } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';

/**
 * The selected-segment pill every two-way switch slides (SegmentedControl, the resumes grid/list
 * toggle, Tailor's Add/Skip), as a translateX on the UI thread.
 *
 * The first real target seats the pill with no motion — a persisted choice must not replay a slide
 * from the first segment on every entry — and every deliberate switch after that springs on
 * `springs.snappy`. Pass `null` while there is nowhere real to put it yet (a track not measured).
 */
export function useSlidingPill(target: number | null) {
  const { motion } = useTheme();
  const reduced = useReducedMotion();
  const offset = useSharedValue(target ?? 0);
  const placed = useRef(false);

  useEffect(() => {
    if (target == null) return;
    if (!placed.current) {
      placed.current = true;
      offset.set(target);
      return;
    }
    offset.set(withSpring(target, withReducedMotion(reduced, motion.springs.snappy)));
  }, [motion.springs.snappy, offset, reduced, target]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
}
