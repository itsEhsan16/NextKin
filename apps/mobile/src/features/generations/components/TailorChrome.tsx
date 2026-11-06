import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { TailorStep } from '@/features/create/components/TailorStepper';
import { scaledSheet } from '@/theme';
import { IconButton } from '@/ui/IconButton';
import { StepProgress } from '@/ui/StepProgress';

export type TailorChromeProps = { onClose: () => void } & (
  { step: TailorStep; stepper?: never } | { stepper?: ReactNode; step?: never }
);

/**
 * The run screens' header (toreview §173): the flow's progress, now on its last step, and the ✕.
 * The older per-flow steppers (`step` / `stepper`) are accepted and drawn as that same bar.
 */
export function TailorChrome({ onClose }: TailorChromeProps) {
  const styles = useStyles();
  return (
    <View style={styles.bar}>
      <View style={styles.progress}>
        <StepProgress step={3} total={3} />
      </View>
      <IconButton icon="XClose" label="Close" variant="outline" onPress={onClose} />
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  bar: { flexDirection: 'row', alignItems: 'center', gap: u(16), paddingTop: u(8) },
  progress: { flex: 1, paddingLeft: u(60) },
}));
