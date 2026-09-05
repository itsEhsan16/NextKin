import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  GENERATION_HINTS,
  GENERATION_STEPS,
  generationStepIndex,
  type Generation,
  type GenerationStep,
} from '@/data/models';
import { useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';

export type GenerationStepsProps = { generation: Generation };

/** Where a row sits relative to the run: behind it, on it, or still ahead of it. */
type StepState = 'done' | 'current' | 'todo';

const CHECK = 16;
const DOT = 10;
const SLOT = 20;

/** A11y state per row. The percentage belongs to the hero; a row only says where it stands. */
const STATE_LABEL: Record<StepState, string> = {
  done: 'done',
  current: 'in progress',
  todo: 'waiting',
};

type StepRowProps = { step: GenerationStep; state: StepState; hint: string; index: number };

function StepRow({ step, state, hint, index }: StepRowProps) {
  const { colors, motion, radii, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduced || state !== 'current') return undefined;
    // The same half-second-and-a-bit opacity breath a Skeleton takes, so "working on it" reads
    // the same everywhere in the app.
    pulse.set(withRepeat(withTiming(1, { duration: motion.durations.pulse }), -1, true));
    return () => cancelAnimation(pulse);
  }, [motion.durations.pulse, pulse, reduced, state]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: 1 - pulse.value * 0.5 }));

  return (
    <Animated.View
      // One element per row: the glyph is decorative and the state is spelled out in words,
      // so a reader hears "Validating, in progress" rather than "circle, Validating".
      accessible
      accessibilityLabel={
        state === 'current' && hint
          ? `${step.label}, ${STATE_LABEL[state]}. ${hint}`
          : `${step.label}, ${STATE_LABEL[state]}`
      }
      entering={
        reduced
          ? undefined
          : FadeInDown.delay(index * motion.stagger.row).duration(motion.durations.base)
      }
      style={[styles.row, { gap: spacing[3], minHeight: s(28) }]}
    >
      <View style={[styles.slot, { width: s(SLOT) }]}>
        {state === 'done' ? (
          <FontAwesome5 name="check-circle" size={s(CHECK)} color={colors.success} solid />
        ) : (
          <Animated.View
            style={[
              {
                width: s(DOT),
                height: s(DOT),
                borderRadius: radii.full,
                backgroundColor: state === 'current' ? colors.brand : colors.borderDashed,
              },
              state === 'current' ? pulseStyle : null,
            ]}
          />
        )}
      </View>

      <View style={styles.copy}>
        <Text
          variant={state === 'current' ? 'bodySemiBold' : 'body'}
          color={state === 'todo' ? 'textTertiary' : 'textPrimary'}
        >
          {step.label}
        </Text>
        {state === 'current' && hint ? (
          <Text variant="caption" color="textSecondary">
            {hint}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

/**
 * The five pipeline steps of V2 §7.6 as a list, so a running job shows *which* stage it is at
 * and not merely that it is moving: a check behind it, a pulsing dot on it, muted ahead of it.
 *
 * No artboard exists for the generation flow (plan §8), so this is built from existing
 * primitives, tokens and motion only. The hero above owns the percentage; this list deliberately
 * never repeats it.
 */
export function GenerationSteps({ generation }: GenerationStepsProps) {
  const { spacing } = useTheme();
  const currentIndex = generationStepIndex(generation.status);
  // 'ready' is the last step *and* the end of the run, so it reads as a check like the rest
  // rather than as something still happening.
  const finished = generation.status === 'ready';

  return (
    <View style={{ gap: spacing[3] }}>
      {GENERATION_STEPS.map((step, index) => (
        <StepRow
          key={step.status}
          step={step}
          index={index}
          state={
            finished || index < currentIndex
              ? 'done'
              : index === currentIndex
                ? 'current'
                : 'todo'
          }
          // Per-kind override first: 9D runs cover letters and ATS checks through this screen,
          // and "Tailoring your resume to the role" is wrong for both.
          hint={GENERATION_HINTS[generation.kind]?.[step.status] ?? step.hint}
        />
      ))}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  slot: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: s(2) },
}));
