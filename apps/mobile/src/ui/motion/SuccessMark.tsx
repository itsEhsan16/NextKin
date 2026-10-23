import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useReducedMotion } from '@/lib';
import { useTheme } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type SuccessMarkProps = {
  /** Diameter (or tile side), already scaled. */
  size: number;
  /**
   * `circle`: a solid green disc with a white tick, the app's `check-circle` drawn live.
   * `tile`: the soft green rounded tile with a green tick (a run's "ready" card).
   */
  variant?: 'circle' | 'tile';
  /** Corner radius of the tile variant. */
  radius?: number;
  /**
   * Play the arrival: the mark pops up and its tick draws itself in. Off, it rests drawn — pass
   * it only for a success that happened while the user watched (`useBecameTrue`), so a revisit
   * does not celebrate again.
   */
  animate?: boolean;
};

// The tick in a 24-unit box, and its length (two legs: 3.5·√2 and √(6.5² + 7²)), rounded up
// so the dash hides it completely.
const TICK = 'M7 12.5 L10.5 16 L17 9';
const TICK_LENGTH = 15;
const VIEWBOX = 24;
const STROKE = 2.4;

/**
 * The success moment: a check that lands rather than appears. The disc springs up from
 * `scales.popFrom` and the tick draws over `durations.draw`, a beat after it. Still under Reduce
 * Motion. Decorative — the words beside it say what succeeded.
 */
export function SuccessMark({ size, variant = 'circle', radius, animate = true }: SuccessMarkProps) {
  const { colors, motion, radii } = useTheme();
  const reduced = useReducedMotion();
  const play = animate && !reduced;

  const pop = useSharedValue(play ? 0 : 1);
  const draw = useSharedValue(play ? 0 : 1);

  useEffect(() => {
    if (!play) return;
    pop.set(withSpring(1, motion.springs.bouncy));
    draw.set(
      withDelay(
        motion.durations.press,
        withTiming(1, { duration: motion.durations.draw, easing: motion.easings.decelerate }),
      ),
    );
  }, [draw, motion, play, pop]);

  const popStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 2),
    transform: [{ scale: motion.scales.popFrom + (1 - motion.scales.popFrom) * pop.value }],
  }));

  const tickProps = useAnimatedProps(() => ({
    strokeDashoffset: TICK_LENGTH * (1 - draw.value),
  }));

  const tile = variant === 'tile';

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: size, height: size },
        tile
          ? {
              borderRadius: radius ?? radii.lg,
              backgroundColor: colors.successSurface,
              alignItems: 'center',
              justifyContent: 'center',
            }
          : null,
        popStyle,
      ]}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          {tile ? null : <Circle cx={12} cy={12} r={12} fill={colors.success} />}
          <AnimatedPath
            d={TICK}
            fill="none"
            stroke={tile ? colors.success : colors.textOnBrand}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={TICK_LENGTH}
            animatedProps={tickProps}
          />
        </Svg>
      </View>
    </Animated.View>
  );
}
