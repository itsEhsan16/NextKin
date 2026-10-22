import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { motion } from '@/theme';

export type RevealProps = {
  /**
   * Which state is showing ("writing", "ready", …). When it changes, the old content fades out as
   * the new content fades in, instead of one hard-cutting to the other.
   */
  stateKey: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * A keyed cross-fade between the states of one region — a run's progress view and its result,
 * its two action bars, a spinner and its check.
 *
 * The outgoing state leaves layout at once and fades where it stood, so the two overlap for a
 * moment without the page reserving room for both. A region that mounts with its screen does not
 * fade in: `Screen` skips entrances on its first mount, so only a real change animates.
 */
export function Reveal({ stateKey, style, children }: RevealProps) {
  const reduced = useReducedMotion();

  return (
    <Animated.View
      key={stateKey}
      entering={reduced ? undefined : FadeIn.duration(motion.durations.base)}
      exiting={reduced ? undefined : FadeOut.duration(motion.durations.fast)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
