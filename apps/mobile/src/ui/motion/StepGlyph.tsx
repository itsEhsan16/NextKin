import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/lib';
import { motion, useTheme, type ColorToken } from '@/theme';

import { Spinner } from './Spinner';
import { Icon, lineBox } from '@/ui/Icon';

/**
 * Where a step stands: behind the work (`done`), on it (`current`), ahead of it (`todo`), or
 * deliberately left out (`left`: a keyword the user chose to skip).
 */
export type StepState = 'done' | 'current' | 'todo' | 'left';

export type StepGlyphProps = {
  state: StepState;
  /** The tick and the "left out" mark, already scaled. */
  size: number;
  /** The turning ring on the current step; `size` by default. */
  ringSize?: number;
  /** The hollow circle ahead of the work; `size` by default. */
  todoSize?: number;
  /** The hollow circle's colour. */
  todoColor?: ColorToken;
};

/**
 * A tick that lands: it springs up from `scales.popFrom` on the bouncy spring as it fades in,
 * the motion spec's "badge pop". It plays only when a step *becomes* done — see `StepGlyph`.
 */
const tickIn: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: motion.scales.popFrom }] },
    animations: {
      opacity: withTiming(1, motion.timings.fast),
      transform: [{ scale: withSpring(1, motion.springs.bouncy) }],
    },
  };
};

const glyphIn = FadeIn.duration(motion.durations.base);
const glyphOut = FadeOut.duration(motion.durations.fast);

/**
 * The one step indicator: a hollow circle ahead, the brand ring turning on the step being
 * worked, a green tick that pops in when it is done, an amber "!" for a step left out.
 *
 * As a step moves on, the old glyph fades where it stood while the new one arrives, so a
 * checklist never swaps a spinner for a tick in one frame. Glyphs present when the list first
 * appears do not animate (`LayoutAnimationConfig skipEntering`): only a real change does.
 *
 * Decorative: the row it sits in speaks the state in words.
 */
export function StepGlyph({
  state,
  size,
  ringSize = size,
  todoSize = size,
  todoColor = 'borderDashed',
}: StepGlyphProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const box = Math.max(size, ringSize, todoSize);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: box, height: box }}
    >
      <LayoutAnimationConfig skipEntering>
        <Animated.View
          key={state}
          entering={reduced ? undefined : state === 'done' ? tickIn : glyphIn}
          exiting={reduced ? undefined : glyphOut}
          style={[StyleSheet.absoluteFill, styles.centre]}
        >
          {state === 'current' ? (
            <Spinner size={ringSize} />
          ) : state === 'todo' ? (
            <Icon name="Circle" size={lineBox(todoSize)} color={colors[todoColor]} />
          ) : (
            <Icon
              name={state === 'left' ? 'AlertCircle' : 'CheckCircle'}
              size={lineBox(size)}
              color={state === 'left' ? colors.warningAccent : colors.success}
            />
          )}
        </Animated.View>
      </LayoutAnimationConfig>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center' },
});
