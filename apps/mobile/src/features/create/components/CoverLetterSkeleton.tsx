import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/**
 * Block geometry, each one the composed height of the card it stands in for — Card is 16pt of
 * padding and a 1pt hairline on both sides, so every card block carries that 34pt:
 *
 * - `BANNER` 34 + caption 20 + gap 12 + 4pt bar
 * - `LABEL`  the groupLabel line
 * - `ROW`    2 (hairline; the row's own padding is Card's) + 12 + rowTitle 24 + 2 + description
 *            19 + 12, past the 58pt listRow floor
 * - `TONES`  2 (hairline) + 8 + four 61pt radio rows (8 + 24 + 2 + 19 + 8) + 8
 */
const BANNER = 70;
const LABEL = 20;
const ROW = 71;
const TONES = 262;

/**
 * The cover-letter intake's loading state. Blocks in the shape of the content that replaces
 * them, so nothing jumps when the library and the subscription land — never a spinner. The
 * screen pins an inert `StickyActionBar` under it for the same reason: the bar owns the bottom
 * inset, so a loading page without one would resize the viewport the moment the queries settle.
 */
export function CoverLetterSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading cover letter setup" style={{ gap: spacing[6] }}>
      <Skeleton height={s(BANNER)} radius="card" />
      <View style={{ gap: spacing[3] }}>
        <Skeleton width="45%" height={s(LABEL)} />
        <Skeleton height={s(ROW)} radius="card" />
      </View>
      <View style={{ gap: spacing[3] }}>
        <Skeleton width="25%" height={s(LABEL)} />
        <Skeleton height={s(TONES)} radius="card" />
      </View>
    </View>
  );
}
