import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

// SUPPORT 01 at 390 (577:6129), in artboard units.
/** The select chips, 35 tall; two rows at this width (577:6163). */
const CHIP = 35 / 0.75;
const CHIP_GAP_X = 7 / 0.75;
const CHIP_GAP_Y = 8 / 0.75;
const CHIP_ROWS = [
  ['15%', '33%', '23%', '15%'],
  ['18%', '22%'],
] as const;
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
      <View style={{ marginTop: s(SEARCH_TO_CHIPS), gap: s(CHIP_GAP_Y) }}>
        {CHIP_ROWS.map((row, index) => (
          <View key={`chips_${index}`} style={{ flexDirection: 'row', gap: s(CHIP_GAP_X) }}>
            {row.map((width, chip) => (
              <Skeleton key={`chip_${chip}`} width={width} height={s(CHIP)} radius="full" />
            ))}
          </View>
        ))}
      </View>

      <View style={{ marginTop: s(CHIPS_TO_LIST), gap: s(GROUP_GAP) }}>
        {CARDS.map((height, index) => (
          <View key={`group_${index}`} style={{ gap: s(HEADING_TO_CARD) }}>
            <Skeleton width={index === 0 ? '40%' : '28%'} height={s(HEADING)} />
            <Skeleton height={s(height)} radius="cardLg" />
          </View>
        ))}
      </View>
    </View>
  );
}
