import { useEffect } from 'react';
import {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { motion } from '@/theme';

/** One swing's timing: each leg of the nudge takes a third of a press. */
const LEG = { duration: motion.durations.press / 3, easing: motion.easings.standard };

/**
 * A short sideways nudge for an error, the way a wrong passcode shakes: it says "that didn't
 * work" without a modal or a colour flash. It plays once each time `trigger` changes to a new
 * truthy value (an error message, a failure count), and never under Reduce Motion.
 *
 * Returns a style to put on the element that should move.
 */
export function useShake(trigger: unknown) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);

  useEffect(() => {
    if (!trigger || reduced) return;
    const legs = [];
    for (let swing = 0; swing < motion.shake.swings; swing += 1) {
      // Each swing is a little smaller than the one before, so it settles rather than stops.
      const reach = motion.shake.distance * (1 - swing / motion.shake.swings);
      legs.push(withTiming(reach, LEG), withTiming(-reach, LEG));
    }
    legs.push(withTiming(0, LEG));
    x.set(withSequence(...legs));
  }, [reduced, trigger, x]);

  return useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
}
