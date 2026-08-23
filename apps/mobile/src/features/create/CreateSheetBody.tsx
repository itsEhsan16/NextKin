import { useCallback, useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useReducedMotion, withReducedMotion } from '@/lib';
import { useTheme } from '@/theme';

import { CreateSheetStep } from './CreateSheetStep';
import {
  CREATE_RESUME_FOOTNOTE,
  CREATE_RESUME_ROWS,
  CREATE_ROOT_ROWS,
  type CreateAction,
} from './createSteps';

export type CreateStep = 'root' | 'resume';

export type CreateSheetBodyProps = {
  step: CreateStep;
  onStepChange: (step: CreateStep) => void;
  /** Fired for every row that is not the internal "New Resume" push. */
  onAction: (action: Exclude<CreateAction, 'new-resume'>) => void;
};

/**
 * The two create-sheet panes and the transition between them.
 *
 * Canvas note 1:1365: "Back returns to CREATE 01 — the trio is a push within the same sheet,
 * not a new sheet." So both panes live side by side in one row that slides horizontally, while
 * the host sheet morphs its height (600 → 520). Off-screen panes leave the accessibility tree.
 */
export function CreateSheetBody({ step, onStepChange, onAction }: CreateSheetBodyProps) {
  const { motion } = useTheme();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const offset = useSharedValue(step === 'resume' ? 1 : 0);

  useEffect(() => {
    offset.set(
      withSpring(step === 'resume' ? 1 : 0, withReducedMotion(reduced, motion.springs.sheetIn)),
    );
  }, [motion.springs.sheetIn, offset, reduced, step]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -offset.value * width }],
  }));

  const openResumeStep = useCallback(() => onStepChange('resume'), [onStepChange]);
  const backToRoot = useCallback(() => onStepChange('root'), [onStepChange]);

  const handleRoot = useCallback(
    (action: CreateAction) => {
      if (action === 'new-resume') {
        openResumeStep();
        return;
      }
      onAction(action);
    },
    [onAction, openResumeStep],
  );

  const handleResume = useCallback(
    (action: CreateAction) => {
      if (action === 'new-resume') return;
      onAction(action);
    },
    [onAction],
  );

  const rootHidden = step !== 'root';
  const resumeHidden = step !== 'resume';

  return (
    <Animated.View style={[styles.track, { width: width * 2 }, trackStyle]}>
      <View
        style={{ width }}
        accessibilityElementsHidden={rootHidden}
        importantForAccessibility={rootHidden ? 'no-hide-descendants' : 'auto'}
      >
        <CreateSheetStep
          title="Create"
          rows={CREATE_ROOT_ROWS}
          onSelect={handleRoot}
          visible={step === 'root'}
        />
      </View>

      <View
        style={{ width }}
        accessibilityElementsHidden={resumeHidden}
        importantForAccessibility={resumeHidden ? 'no-hide-descendants' : 'auto'}
      >
        <CreateSheetStep
          title="New resume"
          rows={CREATE_RESUME_ROWS}
          onSelect={handleResume}
          onBack={backToRoot}
          footnote={CREATE_RESUME_FOOTNOTE}
          visible={step === 'resume'}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row' },
});
