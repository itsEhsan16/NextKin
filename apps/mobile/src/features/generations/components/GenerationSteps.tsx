import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
import { StepGlyph } from '@/ui/motion';

export type GenerationStepsProps = { generation: Generation };

/** Where a row sits relative to the run: behind it, on it, or still ahead of it. */
type StepState = 'done' | 'current' | 'todo';

const CHECK = 16;
const RING = 15;
const SLOT = 20;

/** A11y state per row. The percentage belongs to the hero; a row only says where it stands. */
const STATE_LABEL: Record<StepState, string> = {
  done: 'done',
  current: 'in progress',
  todo: 'waiting',
};

type StepRowProps = { step: GenerationStep; state: StepState; hint: string; index: number };

function StepRow({ step, state, hint, index }: StepRowProps) {
  const { motion, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

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
        <StepGlyph state={state} size={s(CHECK)} ringSize={s(RING)} />
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
 * and not merely that it is moving: a tick behind it, the turning ring on it, a hollow circle
 * ahead of it — the same `StepGlyph` every checklist in the app uses.
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
            finished || index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo'
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
