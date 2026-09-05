import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/** Three chips of unequal length, the way an extraction actually reads. */
const CHIP_WIDTHS = [118, 84, 96];

/**
 * The JD review form's geometry, drawn empty: a caption, the two labelled fields, and the two
 * skill groups with their chip rows and add fields. Blocks rather than a spinner, so the page
 * does not re-flow when the extraction lands.
 */
export function JdReviewSkeleton() {
  const { sizes, spacing, s } = useTheme();
  return (
    <View style={{ gap: spacing[6] }}>
      <Skeleton width="60%" height={s(16)} />

      {[0, 1].map((field) => (
        <View key={field} style={{ gap: spacing[2] }}>
          <Skeleton width={s(72)} height={s(14)} />
          <Skeleton height={sizes.searchField} radius="xl" />
        </View>
      ))}

      {[0, 1].map((group) => (
        <View key={group} style={{ gap: spacing[3] }}>
          <Skeleton width={s(140)} height={s(20)} />
          <View style={[styles.chips, { gap: spacing[2] }]}>
            {CHIP_WIDTHS.map((width) => (
              <Skeleton key={width} width={s(width)} height={s(32)} radius="full" />
            ))}
          </View>
          <Skeleton height={sizes.searchField} radius="xl" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
