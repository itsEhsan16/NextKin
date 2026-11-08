import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton, SkeletonLines } from '@/ui/Skeleton';

/** Loading shape of PROFILE 01: identity row, stats bar, completeness card, plan row, a group. */
export function ProfileSkeleton() {
  const { s } = useTheme();

  // A fragment: the blocks are the scroller's own children, spaced by its gap like the cards.
  return (
    <>
      <Skeleton height={s(84)} radius="card" />
      <Skeleton height={s(154)} radius="card" />
      <Skeleton height={s(72)} radius="card" />
      <Skeleton height={s(290)} radius="card" />
    </>
  );
}

/**
 * The identity (name, headline, plan pill) traced in the header where it lands (§196): a title
 * bar, a meta bar and the pill, in the identity's own height.
 */
export function ProfileIdentitySkeleton() {
  const { s, spacing } = useTheme();
  return (
    <View style={{ height: s(104), gap: spacing[3] }}>
      <SkeletonLines widths={['55%', '75%']} title={s(24)} line={s(14)} />
      <Skeleton width={s(110)} height={s(26)} radius="full" />
    </View>
  );
}
