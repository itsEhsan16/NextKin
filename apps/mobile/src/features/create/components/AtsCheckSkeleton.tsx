import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/**
 * Block geometry, each one the composed height of what replaces it — Card is 16pt of padding and
 * a 1pt hairline on both sides, so every card block carries that 34pt:
 *
 * - `BANNER`  34 + caption 20 + gap 12 + 4pt bar
 * - `HONESTY` three caption lines of the §7.8 note
 * - `LABEL`   the groupLabel line
 * - `ROW`     2 (hairline; the row's own padding is Card's) + 12 + rowTitle 24 + 2 +
 *             description 19 + 12, past the 58pt listRow floor
 * - `BUTTON`  the ghost "check a file" control under the row
 */
const BANNER = 70;
const HONESTY = 60;
const LABEL = 20;
const ROW = 71;
const BUTTON = 44;

/**
 * The ATS check intake's loading state. Blocks in the shape of the content that replaces them, so
 * nothing jumps when the library and the subscription land — never a spinner. The screen pins an
 * inert `StickyActionBar` under it for the same reason: the bar owns the bottom inset, so a
 * loading page without one would resize the viewport the moment the queries settle.
 */
export function AtsCheckSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading ATS check setup" style={{ gap: spacing[6] }}>
      <Skeleton height={s(BANNER)} radius="card" />
      <Skeleton height={s(HONESTY)} />
      <View style={{ gap: spacing[3] }}>
        <Skeleton width="40%" height={s(LABEL)} />
        <Skeleton height={s(ROW)} radius="card" />
        <Skeleton width="60%" height={s(BUTTON)} radius="card" />
      </View>
    </View>
  );
}
