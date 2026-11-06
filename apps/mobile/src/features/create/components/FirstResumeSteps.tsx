import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { StepGlyph } from '@/ui/motion';
import { Text } from '@/ui/Text';

import type { FirstResumeStage } from '../firstResume';

type StepState = 'done' | 'current' | 'todo';

const STEPS: readonly { stage: FirstResumeStage; label: string; caption: string }[] = [
  { stage: 'add-resume', label: 'Add your resume', caption: 'Upload or start fresh' },
  { stage: 'pick-job', label: 'Pick a job', caption: 'Saved job or a link' },
  { stage: 'done', label: 'Get your resume', caption: 'Tailored, nothing made up' },
];

/** The same words a screen reader gets for the run's own steps. */
const STATE_LABEL: Record<StepState, string> = {
  done: 'done',
  current: 'next',
  todo: 'after that',
};

const stateOf = (index: number, current: number): StepState =>
  index < current ? 'done' : index === current ? 'current' : 'todo';

const CHECK = 16;
const RING = 15;
const SLOT = 20;
const ROW_GAP = 14;

/**
 * The three steps to a first resume (V2 §7.2's guided checklist). No board draws it: it is the run
 * screen's step list, in the same glyphs, so nothing here is a new look (rule 7).
 */
export function FirstResumeSteps({ stage }: { stage: FirstResumeStage }) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const current = STEPS.findIndex((step) => step.stage === stage);

  return (
    <View style={styles.list}>
      {STEPS.map((step, index) => {
        const state = stateOf(index, current);
        return (
          <View
            key={step.stage}
            accessible
            accessibilityLabel={`${step.label}, ${STATE_LABEL[state]}. ${step.caption}`}
            style={[styles.row, { gap: spacing[3] }]}
          >
            <View style={[styles.slot, { width: s(SLOT) }]}>
              <StepGlyph state={state} size={s(CHECK)} ringSize={s(RING)} />
            </View>
            <View style={styles.copy}>
              <Text
                variant={state === 'current' ? 'bodyLgStrong' : 'bodyLg'}
                color={state === 'todo' ? 'textTertiary' : 'textPrimary'}
              >
                {step.label}
              </Text>
              <Text variant="footnote" color="textSecondary">
                {step.caption}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  list: { gap: s(ROW_GAP) },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  slot: { alignItems: 'center', paddingTop: s(2) },
  copy: { flex: 1 },
}));
