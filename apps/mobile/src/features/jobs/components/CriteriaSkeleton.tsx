import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

// JOBS 10 at 390 (580:2428), in artboard units — each block the height of what replaces it.
const RING = 112 / 0.75;
const RING_TO_PILL = 12 / 0.75;
const PILL_W = 112 / 0.75;
const PILL_H = 23 / 0.75;
const PILL_TO_CAPTION = 10 / 0.75;
const CAPTION_W = 190 / 0.75;
const CAPTION_H = 16 / 0.75;
const HERO_TO_NOTE = 20 / 0.75;
const NOTE = 105.5 / 0.75;
const NOTE_TO_CARDS = 14 / 0.75;
const CARD_GAP = 14 / 0.75;
/** A group card is its heading and bar (56.75) plus 34 per row and its 15.75 foot. */
const CARD_BASE = 72.5 / 0.75;
const CARD_ROW = 34 / 0.75;

/** The two groups the skeleton draws — missing leads, so the short group is on top. */
const GROUP_ROWS = [1, 3];

/**
 * The match breakdown's loading state. Blocks in the shape of the content that replaces them, so
 * nothing jumps when the job lands — never a spinner. The screen pins an inert `StickyActionBar`
 * under it for the same reason: the bar owns the bottom inset, so a loading page without one
 * would resize the viewport the moment the query settles.
 */
export function CriteriaSkeleton() {
  const { s } = useTheme();
  const styles = useStyles();

  return (
    <View accessible accessibilityLabel="Loading match breakdown">
      <View style={styles.hero}>
        <Skeleton width={s(RING)} height={s(RING)} radius="full" />
        <Skeleton width={s(PILL_W)} height={s(PILL_H)} radius="full" style={styles.pill} />
        <Skeleton width={s(CAPTION_W)} height={s(CAPTION_H)} style={styles.caption} />
      </View>

      <Skeleton height={s(NOTE)} radius="cardLg" style={styles.note} />

      <View style={styles.cards}>
        {GROUP_ROWS.map((rows, index) => (
          <Skeleton key={index} height={s(CARD_BASE + rows * CARD_ROW)} radius="cardLg" />
        ))}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  hero: { alignItems: 'center' },
  pill: { marginTop: s(RING_TO_PILL) },
  caption: { marginTop: s(PILL_TO_CAPTION) },
  note: { marginTop: s(HERO_TO_NOTE) },
  cards: { marginTop: s(NOTE_TO_CARDS), gap: s(CARD_GAP) },
}));
