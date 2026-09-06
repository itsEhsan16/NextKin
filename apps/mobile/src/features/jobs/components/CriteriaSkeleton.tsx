import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/**
 * Block geometry, each one the composed height of the thing it stands in for:
 *
 * - `RING`  the ScoreRing box, and `PILL` the band pill beside it (5 + 20 + 5)
 * - `NOTE`  Card's 16pt padding and 1pt hairline on both sides (34) + three 22pt body lines
 * - `ROW`   a criterion row: 16 + the 21pt label line + 16
 * - a group is its overline (`LABEL`) over a card of `ROW`s plus the card's own 2pt of hairline
 */
const RING = 132;
const PILL_WIDTH = 110;
const PILL_HEIGHT = 30;
const NOTE = 100;
const LABEL = 20;
const ROW = 53;
const CARD_BORDER = 2;

/** The two groups the skeleton draws — missing leads, so the short group is on top. */
const GROUP_ROWS = [1, 3];

/**
 * The match breakdown's loading state. Blocks in the shape of the content that replaces them, so
 * nothing jumps when the job lands — never a spinner. The screen pins an inert `StickyActionBar`
 * under it for the same reason: the bar owns the bottom inset, so a loading page without one
 * would resize the viewport the moment the query settles.
 */
export function CriteriaSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading match breakdown" style={{ gap: spacing[6] }}>
      <View style={{ alignItems: 'center', gap: spacing[3] }}>
        <Skeleton width={s(RING)} height={s(RING)} radius="full" />
        <Skeleton width={s(PILL_WIDTH)} height={s(PILL_HEIGHT)} radius="full" />
      </View>

      <Skeleton height={s(NOTE)} radius="cardLg" />

      <View style={{ gap: spacing[5] }}>
        {GROUP_ROWS.map((rows, index) => (
          <View key={index} style={{ gap: spacing[2] }}>
            <Skeleton width="30%" height={s(LABEL)} />
            <Skeleton height={s(rows * ROW + CARD_BORDER)} radius="card" />
          </View>
        ))}
      </View>
    </View>
  );
}
