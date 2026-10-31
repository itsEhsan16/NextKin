import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useTheme, type ColorToken } from '@/theme';

import { useLoop } from './useLoop';

export type SpinnerProps = {
  /** Ring size, already scaled. */
  size: number;
  color?: ColorToken;
};

/**
 * The app's one "working on it" ring (TAILOR 04 608:237), drawn as the web's `Spinner` is: a
 * ring with one quarter open, turning once per `durations.pulse`. Used for the step being worked
 * on and for small inline waits (a file being read, a fix being applied), where the platform's own
 * spinner would look borrowed. Still under Reduce Motion.
 */
export function Spinner({ size, color = 'brand' }: SpinnerProps) {
  const { colors, motion, radii } = useTheme();
  const turn = useLoop(true, motion.durations.pulse);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));

  return (
    <Animated.View style={spin}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radii.full,
          // 2 on the web's 16 ring.
          borderWidth: size / 8,
          borderColor: colors[color],
          borderRightColor: 'transparent',
        }}
      />
    </Animated.View>
  );
}
