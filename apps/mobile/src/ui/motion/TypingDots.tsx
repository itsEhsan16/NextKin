import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useTheme, type ColorToken } from '@/theme';

import { useLoop } from './useLoop';

export type TypingDotsProps = {
  /** Dot diameter, already scaled. */
  size: number;
  color?: ColorToken;
};

const DOTS = [0, 1, 2] as const;
/** How far behind the one before it each dot rises, as a share of the wave. */
const LAG = 1 / 6;
/** A dot rises half its own height at the top of the wave. */
const RISE = 0.5;
/** Dots sit a little over half a dot apart. */
const GAP = 0.6;

function Dot({
  index,
  size,
  color,
  clock,
}: {
  index: number;
  size: number;
  color: string;
  clock: SharedValue<number>;
}) {
  const { opacity } = useTheme();
  const rest = opacity.disabled;

  const wave = useAnimatedStyle(() => {
    const lift = Math.max(0, Math.sin(2 * Math.PI * (clock.value - index * LAG)));
    return {
      opacity: rest + (1 - rest) * lift,
      transform: [{ translateY: -lift * size * RISE }],
    };
  });

  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, wave]}
    />
  );
}

/**
 * Three dots that rise and brighten in turn: someone is composing a reply. One clock drives all
 * three (`loops.dots`), each a sixth of a wave behind the last. Decorative — the words beside it
 * say what is happening — and still under Reduce Motion, where the dots rest dimmed.
 */
export function TypingDots({ size, color = 'textTertiary' }: TypingDotsProps) {
  const { colors, motion } = useTheme();
  const clock = useLoop(true, motion.loops.dots);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', gap: size * GAP, height: size * 2 }}
    >
      {DOTS.map((index) => (
        <Dot key={index} index={index} size={size} color={colors[color]} clock={clock} />
      ))}
    </View>
  );
}
