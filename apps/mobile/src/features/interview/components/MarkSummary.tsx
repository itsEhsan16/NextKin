import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { InterviewMarkCounts } from '@/data/models';
import { scaledSheet, useTheme } from '@/theme';
import { Pill } from '@/ui/Pill';
import { ProgressBar } from '@/ui/Progress';

// INTERVIEW 01 / 04 at 390 (577:971 / 577:3875), in artboard units.
const BAR_H = 6 / 0.75;
const BAR_TO_PILLS = 10 / 0.75;
const PILL_GAP = 6 / 0.75;

/**
 * The green bar and the count pills under it — "2 confident", "1 needs work", "7 to go" — as the
 * set card (577:971) and the practice header (577:3877) draw them. A count of nought is left out
 * rather than drawn as "0 confident". `extra` rides at the end of the pill row (the generic label).
 */
export function MarkSummary({ counts, extra }: { counts: InterviewMarkCounts; extra?: ReactNode }) {
  const { s } = useTheme();
  const styles = useStyles();

  return (
    <View style={{ gap: s(BAR_TO_PILLS) }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ProgressBar
          value={counts.total > 0 ? counts.marked / counts.total : 0}
          height={s(BAR_H)}
          trackColor="surfaceSubtle"
          fillColor="success"
        />
      </View>
      <View style={styles.pills}>
        {counts.confident > 0 ? (
          <Pill label={`${counts.confident} confident`} tone="success" dot />
        ) : null}
        {counts.needsWork > 0 ? (
          <Pill
            label={`${counts.needsWork} ${counts.needsWork === 1 ? 'needs' : 'need'} work`}
            tone="warning"
            dot
          />
        ) : null}
        {counts.unmarked > 0 ? <Pill label={`${counts.unmarked} to go`} /> : null}
        {extra}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: s(PILL_GAP) },
}));
