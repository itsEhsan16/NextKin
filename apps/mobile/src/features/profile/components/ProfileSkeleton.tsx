import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/** Loading shape of PROFILE 01: identity row, stats bar, completeness card, plan row, a group. */
export function ProfileSkeleton() {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing[5] }}>
      <View style={[styles.identity, { gap: spacing[4] }]}>
        <Skeleton width={104} height={104} radius="full" />
        <View style={[styles.lines, { gap: spacing[2] }]}>
          <Skeleton width="70%" height={26} />
          <Skeleton width="55%" height={18} />
          <Skeleton width={110} height={26} radius="full" />
        </View>
      </View>
      <Skeleton height={84} radius="card" />
      <Skeleton height={154} radius="card" />
      <Skeleton height={72} radius="card" />
      <Skeleton height={290} radius="card" />
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center' },
  lines: { flex: 1 },
});
