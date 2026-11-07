import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/** Loading shape of PROFILE 01: identity row, stats bar, completeness card, plan row, a group. */
export function ProfileSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View style={{ gap: spacing[5] }}>
      {/* The identity row as one block, the avatar's height (§191). */}
      <Skeleton height={s(104)} radius="card" />
      <Skeleton height={s(84)} radius="card" />
      <Skeleton height={s(154)} radius="card" />
      <Skeleton height={s(72)} radius="card" />
      <Skeleton height={s(290)} radius="card" />
    </View>
  );
}
