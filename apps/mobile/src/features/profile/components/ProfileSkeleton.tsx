import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/** Loading shape of PROFILE 01: identity row, stats bar, completeness card, plan row, a group. */
export function ProfileSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View style={{ gap: spacing[5] }}>
      <View style={[styles.identity, { gap: spacing[4] }]}>
        <Skeleton width={s(104)} height={s(104)} radius="full" />
        <View style={[styles.lines, { gap: spacing[2] }]}>
          <Skeleton width="70%" height={s(26)} />
          <Skeleton width="55%" height={s(18)} />
          <Skeleton width={s(110)} height={s(26)} radius="full" />
        </View>
      </View>
      <Skeleton height={s(84)} radius="card" />
      <Skeleton height={s(154)} radius="card" />
      <Skeleton height={s(72)} radius="card" />
      <Skeleton height={s(290)} radius="card" />
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center' },
  lines: { flex: 1 },
});
