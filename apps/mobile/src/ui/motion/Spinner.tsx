import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useTheme, type ColorToken } from '@/theme';

import { useLoop } from './useLoop';

export type SpinnerProps = {
  /** Glyph size, already scaled. */
  size: number;
  color?: ColorToken;
};

/**
 * The app's one "working on it" ring (TAILOR 04 608:237): a brand `circle-notch` turning once
 * per `durations.pulse`. Used for the step being worked on and for small inline waits (a file
 * being read, a fix being applied), where the platform's own spinner would look borrowed.
 * Still under Reduce Motion.
 */
export function Spinner({ size, color = 'brand' }: SpinnerProps) {
  const { colors, motion } = useTheme();
  const turn = useLoop(true, motion.durations.pulse);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));

  return (
    <Animated.View style={spin}>
      <FontAwesome5 name="circle-notch" size={size} color={colors[color]} solid />
    </Animated.View>
  );
}
