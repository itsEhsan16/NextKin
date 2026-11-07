import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

// SUPPORT 01 at 390 (577:6129), in artboard units.
/** The select chips, 35 tall; two rows at this width (577:6163). */
const CHIP = 35 / 0.75;
const CHIP_GAP_Y = 8 / 0.75;
const SEARCH_TO_CHIPS = 12 / 0.75;
const CHIPS_TO_LIST = 18 / 0.75;
/** A topic heading's 21pt line (577:6178), then 8 down to its card. */
const HEADING = 21 / 0.75;
const HEADING_TO_CARD = 8 / 0.75;
const GROUP_GAP = 16 / 0.75;
/** Two topic cards: three rows and two rows of 42 plus the card's insets (577:6182 closed). */
const CARDS = [134 / 0.75, 92 / 0.75] as const;

/**
 * The help screen's loading state, under the hero. Blocks in the shape of what replaces them — the
 * search field at its real height, the two chip rows, then topic headings over their cards — so
 * nothing on the page moves when the FAQ lands. Never a spinner.
 */
export function HelpSkeleton() {
  const { sizes, s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading help">
      <Skeleton height={sizes.searchField} radius="xl" />
      {/* One strip for the two chip rows (§191). */}
      <Skeleton
        height={s(CHIP) * 2 + s(CHIP_GAP_Y)}
        radius="lg"
        style={{ marginTop: s(SEARCH_TO_CHIPS) }}
      />

      <View style={{ marginTop: s(CHIPS_TO_LIST), gap: s(GROUP_GAP) }}>
        {/* A topic's heading and card as one block (§191). */}
        {CARDS.map((height, index) => (
          <Skeleton
            key={`group_${index}`}
            height={s(HEADING) + s(HEADING_TO_CARD) + s(height)}
            radius="cardLg"
          />
        ))}
      </View>
    </View>
  );
}
