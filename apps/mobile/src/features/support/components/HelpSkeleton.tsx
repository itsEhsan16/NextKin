import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Skeleton } from '@/ui/Skeleton';

/** The question line inside a row — one `rowTitle` line, not the whole row. */
const LINE = 20;
/** The topic chips: `filter` chip padding (10 top and bottom) around a 20pt segment line. */
const CHIP = 40;
const CHIP_WIDTHS = ['22%', '38%', '28%', '24%'] as const;
/** Row inset inside the carded list — the same one `FaqList` draws. */
const ROW_INSET = 19;
/** Questions vary in length, so the bars do too; a column of identical bars reads as a table. */
const ROW_WIDTHS = ['82%', '64%', '75%', '58%', '70%', '66%'] as const;
/**
 * The "Still stuck?" card: 34 (Card padding and hairline, both sides) + a 26pt section line + 12
 * + two 25pt prose lines + 12 + the 52pt button.
 */
const FOOTER = 186;

/**
 * The help screen's loading state. Blocks in the shape of what replaces them — the search field
 * at its real height, a chip row, then rows at `sizes.listRow` — so nothing on the page moves
 * when the FAQ lands. Never a spinner.
 */
export function HelpSkeleton() {
  const { sizes, spacing, s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading help" style={{ gap: spacing[5] }}>
      <View style={{ gap: spacing[3] }}>
        <Skeleton height={sizes.searchField} radius="xl" />
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          {CHIP_WIDTHS.map((width) => (
            <Skeleton key={width} width={width} height={s(CHIP)} radius="full" />
          ))}
        </View>
      </View>

      <Card radius="card" padding={0}>
        {ROW_WIDTHS.map((width) => (
          <View
            key={width}
            style={{
              height: sizes.listRow,
              justifyContent: 'center',
              paddingHorizontal: s(ROW_INSET),
            }}
          >
            <Skeleton width={width} height={s(LINE)} radius="xs" />
          </View>
        ))}
      </Card>

      <Skeleton height={s(FOOTER)} radius="cardLg" />
    </View>
  );
}
