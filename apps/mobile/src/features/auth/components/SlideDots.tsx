import { View } from 'react-native';

import { board } from '../board';
import { scaledSheet, useTheme } from '@/theme';

export type SlideDotsProps = {
  count: number;
  index: number;
  /** Drawn dot diameter and the gap between dots — all three slides now draw 14 at 17. */
  size: number;
  gap: number;
};

/** The paging dots under each onboarding slide (Figma 307:4176 / 307:4282 / 309:3). */
export function SlideDots({ count, index, size, gap }: SlideDotsProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();

  return (
    // One node for the whole group: three separate "dot" announcements say nothing useful.
    <View accessible accessibilityRole="text" accessibilityLabel={`Slide ${index + 1} of ${count}`}
      style={[styles.row, { gap: s(board(gap)) }]}
    >
      {Array.from({ length: count }, (_, dot) => (
        <View
          key={dot}
          style={{
            width: s(board(size)),
            height: s(board(size)),
            borderRadius: radii.full,
            backgroundColor: dot === index ? colors.dotActive : colors.dotInactive,
          }}
        />
      ))}
    </View>
  );
}

const useStyles = scaledSheet(() => ({
  row: { flexDirection: 'row', alignItems: 'center' },
}));
