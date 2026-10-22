import { View } from 'react-native';

import { CARD_GAP } from '@/features/profile/components/cards';
import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

// LEGAL 01 at 390 (577:8911 / 577:8963 …), in artboard units.
/** The contents card: a header and seven 44pt rows (577:8911). */
const CONTENTS = 375.5 / 0.75;
/** Section cards run 230–320 tall; three of them fill the first screen past the contents. */
const SECTIONS = [233.5 / 0.75, 256.5 / 0.75, 255.5 / 0.75] as const;

/**
 * The legal document's body while it loads, under the hero: the contents card and section cards
 * as blocks at their drawn heights, so the page does not reflow when the document lands. Never a
 * spinner — a long read wants its shape shown while it loads.
 */
export function LegalSkeleton() {
  const { s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading document" style={{ gap: s(CARD_GAP) }}>
      <Skeleton height={s(CONTENTS)} radius="cardLg" />
      {SECTIONS.map((height, index) => (
        <Skeleton key={`legal_skeleton_${index}`} height={s(height)} radius="cardLg" />
      ))}
    </View>
  );
}
