import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/** Matches the hero's 64pt mark and the 88pt `SimilarJobCard`, so nothing jumps when data lands. */
const LOGO = 64;
const ROLE_ROW = 88;

/**
 * Loading shape of the company screen: the hero, the website row, three lines of the About
 * paragraph and two role rows.
 */
export function CompanySkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View style={{ gap: spacing[6] }}>
      <View style={[styles.hero, { gap: spacing[3] }]}>
        <Skeleton width={s(LOGO)} height={s(LOGO)} radius="xxl" />
        <View style={[styles.lines, { gap: spacing[2] }]}>
          <Skeleton width="70%" height={s(28)} />
          <Skeleton width="55%" height={s(18)} />
        </View>
      </View>
      <Skeleton height={s(58)} radius="card" />
      <View style={{ gap: spacing[2] }}>
        <Skeleton width={s(120)} height={s(22)} />
        <Skeleton height={s(18)} />
        <Skeleton height={s(18)} />
        <Skeleton width="60%" height={s(18)} />
      </View>
      <View style={{ gap: spacing[3] }}>
        <Skeleton width={s(180)} height={s(22)} />
        {[0, 1].map((index) => (
          <Skeleton key={index} height={s(ROLE_ROW)} radius="card" />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center' },
  lines: { flex: 1 },
});
