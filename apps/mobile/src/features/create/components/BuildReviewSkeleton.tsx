import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

// BUILD 04 at 390 (653:56), in artboard units: each block the height of what replaces it.
const SOURCE = 40.5 / 0.75; // 653:71
const SOURCE_TO_CARD = 12 / 0.75;
const CARD = 193.5 / 0.75; // 653:76
const CARD_TO_NOTE = 12 / 0.75;
const NOTE = 60 / 0.75; // 653:109

/** BUILD 04 while the read job loads: the source row, the card and the tip. */
export function BuildReviewSkeleton() {
  const { s } = useTheme();
  return (
    <View accessible accessibilityLabel="Loading the job" accessibilityState={{ busy: true }}>
      <Skeleton height={s(SOURCE)} radius="xl" />
      <Skeleton height={s(CARD)} radius="card" style={{ marginTop: s(SOURCE_TO_CARD) }} />
      <Skeleton height={s(NOTE)} radius="lg" style={{ marginTop: s(CARD_TO_NOTE) }} />
    </View>
  );
}
