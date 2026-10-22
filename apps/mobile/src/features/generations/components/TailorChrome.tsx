import type { ReactNode } from 'react';
import { View } from 'react-native';

import { TailorStepper, type TailorStep } from '@/features/create/components/TailorStepper';
import { scaledSheet, useTheme } from '@/theme';
import { IconButton } from '@/ui/IconButton';

/**
 * Either Tailor's own stepper at `step`, or any other flow's stepper as a node — the cover
 * letter's Set up · Write · Download (COVER 02–04) passes `<FlowStepper steps={COVER_STEPS} />`.
 * Neither draws the ✕ alone: Home's Build Resume run has no stepper (BUILD 05/06 598:117).
 */
export type TailorChromeProps = { onClose: () => void } & (
  { step: TailorStep; stepper?: never } | { stepper?: ReactNode; step?: never }
);

/** Close bar → stepper on TAILOR 04/05 (608:197 → 608:251), in artboard units. */
const BAR_TO_STEPS = 12 / 0.75;

/**
 * The top of a job-first tailoring run (TAILOR 04–06): a ✕ that leaves the flow, then the
 * Compare · Fix · Download stepper. No title — the hero under it names the screen.
 */
export function TailorChrome({ step, stepper, onClose }: TailorChromeProps) {
  const { spacing } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.wrap, { paddingTop: spacing.headerTopPushed }]}>
      <View style={styles.bar}>
        <IconButton icon="times" label="Close" onPress={onClose} />
      </View>
      {step ? <TailorStepper current={step} /> : stepper}
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  wrap: { gap: s(BAR_TO_STEPS) },
  bar: { flexDirection: 'row' },
}));
