import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton, SkeletonCircle, SkeletonLines } from '@/ui/Skeleton';

import { SectionHeadingSkeleton } from './SectionHeadingSkeleton';

/** ResumeProgressCard's thumbnail and ring at 390. */
const THUMB = { width: 80, height: 96 } as const;
const RING = 80;
/** ResumeProgressCard's padding at 390. */
const PAD = { vertical: 25, horizontal: 21 } as const;

/**
 * "Your Resume Progress" loading (§196): the resume row traced as its page thumbnail, the title
 * and freshness lines with the completeness bar under them, and the ATS ring. `framed` adds the
 * card's own padding and heading, for Home's first paint, where the card itself isn't drawn yet.
 */
export function ResumeProgressSkeleton({ framed = false }: { framed?: boolean }) {
  const { s, spacing } = useTheme();
  const row = (
    <View style={[styles.row, { gap: spacing[4] }]}>
      <Skeleton width={s(THUMB.width)} height={s(THUMB.height)} radius="xs" />
      <View style={[styles.grow, { gap: spacing[3] }]}>
        <SkeletonLines widths={['80%', '55%']} />
        <Skeleton height={s(8)} radius="full" />
      </View>
      <SkeletonCircle size={s(RING)} />
    </View>
  );
  if (!framed) return row;
  return (
    <View
      style={{
        paddingVertical: s(PAD.vertical),
        paddingHorizontal: s(PAD.horizontal),
        gap: spacing[4],
      }}
    >
      <SectionHeadingSkeleton />
      {row}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});
