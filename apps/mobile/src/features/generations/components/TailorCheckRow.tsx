import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { StepGlyph, type StepState } from '@/ui/motion';

/**
 * Where a row stands. `done` and `left` are the "What changed" card's two kinds (TAILOR 05
 * 608:317 / 608:329); `done`, `current` and `todo` are the progress checklist's (TAILOR 04 608:227).
 */
export type TailorCheckState = StepState;

export type TailorCheckRowProps = {
  label: string;
  state: TailorCheckState;
};

// One checklist row at 390 (608:227), in artboard units.
const PAD_Y = 7 / 0.75;
const GAP = 12 / 0.75;
const SLOT_W = 18 / 0.75;
const SLOT_H = 20 / 0.75;
const GLYPH = 16 / 0.75;
const SPINNER = 15 / 0.75;

const STATE_LABEL: Record<TailorCheckState, string> = {
  done: 'done',
  current: 'in progress',
  todo: 'waiting',
  left: 'left out',
};

/**
 * A check-circle row: green tick for done, amber "!" for a keyword the user chose to skip, a
 * turning brand ring on the current step and a hollow grey circle ahead of it (`StepGlyph`, which
 * cross-fades the glyph as the step moves on and pops the tick in). One element per row for a
 * screen reader: the glyph is decorative and the state is spoken.
 */
export function TailorCheckRow({ label, state }: TailorCheckRowProps) {
  const { s } = useTheme();
  const styles = useStyles();

  return (
    <View accessible accessibilityLabel={`${label}, ${STATE_LABEL[state]}`} style={styles.row}>
      <View style={styles.slot}>
        <StepGlyph state={state} size={s(GLYPH)} ringSize={s(SPINNER)} />
      </View>
      <Text variant={state === 'current' ? 'label' : 'bulletBody'} style={styles.copy}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: s(GAP), paddingVertical: s(PAD_Y) },
  slot: { width: s(SLOT_W), height: s(SLOT_H), alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
}));
