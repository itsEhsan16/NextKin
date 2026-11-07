import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton, SkeletonBlock } from '@/ui/Skeleton';

/** Usage card: a caption over the 4pt meter, inside the card's own padding. */
const BANNER = 76;

/**
 * The JD review form's loading state (redrawn as blocks, §191): one block per part of the form, in
 * that part's own height, so the page does not move when the extraction lands. The usage card,
 * the four details, the seniority chips, the three chip groups and the responsibilities.
 */
export function JdReviewSkeleton() {
  const { sizes, spacing, s } = useTheme();
  const field = s(14) + spacing[2] + sizes.searchField;
  // The caption, then four labelled fields, one of them with a helper line.
  const details = s(16) + spacing[6] + field * 4 + spacing[6] * 3 + spacing[2] + s(14);
  const levels = s(14) + spacing[3] + s(34);
  // A heading, a row of chips and its add row.
  const group = s(20) + spacing[3] + s(32) + spacing[3] + sizes.searchField;
  // A heading, three lines and the add row.
  const duties = s(20) + (spacing[3] + sizes.searchField) * 4;

  return (
    <View style={{ gap: spacing[6] }}>
      <Skeleton height={s(BANNER)} radius="card" />
      <SkeletonBlock height={details} />
      <SkeletonBlock height={levels} />
      {[0, 1, 2].map((key) => (
        <SkeletonBlock key={key} height={group} />
      ))}
      <SkeletonBlock height={duties} />
    </View>
  );
}
