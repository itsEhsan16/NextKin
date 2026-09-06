import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/**
 * Block geometry, each the composed height of the card it stands in for — Card is 16pt of padding
 * and a 1pt hairline on both sides, so every card block carries that 34pt:
 *
 * - `BANNER`  34 + a 36pt tile
 * - `USAGE`   34 + groupLabel 20 + three (caption 20 + 8 + 4pt bar) rows + three 16pt gaps
 * - `PERIOD`  the segmented control's own height
 * - `TILE`    34 + title 24 + 8 + price 30 + 8 + caption 20
 */
const BANNER = 70;
const USAGE = 198;
const PERIOD = 48;
const TILE = 124;

export const LOADING_LABEL = 'Loading plans';

/**
 * The plan screen's loading state: blocks in the shape of the banner, the usage meter, the
 * billing-period control and the two plan tiles, so nothing jumps when the queries land. The
 * screen pins an inert `StickyActionBar` under it because that bar owns the bottom safe-area
 * inset — a loading page without one would resize the viewport the moment the plans arrive.
 */
export function UpgradeSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View accessible accessibilityLabel={LOADING_LABEL} style={{ gap: spacing[5] }}>
      <Skeleton height={s(BANNER)} radius="card" />
      <Skeleton height={s(USAGE)} radius="card" />
      <Skeleton height={s(PERIOD)} radius="xl" />
      <View style={{ gap: spacing[3] }}>
        <Skeleton height={s(TILE)} radius="card" />
        <Skeleton height={s(TILE)} radius="card" />
      </View>
    </View>
  );
}
