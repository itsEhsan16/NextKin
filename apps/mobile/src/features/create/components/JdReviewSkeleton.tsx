import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/** Three chips of unequal length, the way an extraction actually reads. */
const CHIP_WIDTHS = [118, 84, 96];
/** The four seniority chips beside "Experience level". */
const LEVEL_WIDTHS = [64, 88, 76, 60];
/** Label + 52pt box, and the Company field carries a helper line under it. */
const FIELDS: readonly boolean[] = [false, true, false, false];
/** "Add" is a hugging secondary button, so the field beside it is not full width. */
const ADD_BUTTON = 64;
/** Usage card: a caption over the 4pt meter, inside the card's own padding. */
const BANNER = 76;

/**
 * The JD review form's geometry, drawn empty: the quota card, the caption, the four labelled
 * fields, the seniority chips, the three chip groups with their add rows, and the editable
 * responsibilities. Blocks rather than a spinner, so the page does not re-flow when the
 * extraction lands.
 */
export function JdReviewSkeleton() {
  const { sizes, spacing, s } = useTheme();

  const addRow = (
    <View style={[styles.row, { gap: spacing[3] }]}>
      <Skeleton height={sizes.searchField} radius="xl" style={styles.grow} />
      <Skeleton width={s(ADD_BUTTON)} height={sizes.searchField} radius="xl" />
    </View>
  );

  return (
    <View style={{ gap: spacing[6] }}>
      <Skeleton height={s(BANNER)} radius="card" />
      <Skeleton width="60%" height={s(16)} />

      {FIELDS.map((helper, field) => (
        <View key={field} style={{ gap: spacing[2] }}>
          <Skeleton width={s(72)} height={s(14)} />
          <Skeleton height={sizes.searchField} radius="xl" />
          {helper ? <Skeleton width="70%" height={s(14)} /> : null}
        </View>
      ))}

      <View style={{ gap: spacing[3] }}>
        <Skeleton width={s(110)} height={s(14)} />
        <View style={[styles.chips, { gap: spacing[2] }]}>
          {LEVEL_WIDTHS.map((width) => (
            <Skeleton key={width} width={s(width)} height={s(34)} radius="full" />
          ))}
        </View>
      </View>

      {[0, 1, 2].map((group) => (
        <View key={group} style={{ gap: spacing[3] }}>
          <Skeleton width={s(140)} height={s(20)} />
          <View style={[styles.chips, { gap: spacing[2] }]}>
            {CHIP_WIDTHS.map((width) => (
              <Skeleton key={width} width={s(width)} height={s(32)} radius="full" />
            ))}
          </View>
          {addRow}
        </View>
      ))}

      <View style={{ gap: spacing[3] }}>
        <Skeleton width={s(160)} height={s(20)} />
        {[0, 1, 2].map((line) => (
          <Skeleton key={line} height={sizes.searchField} radius="xl" />
        ))}
        {addRow}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});
