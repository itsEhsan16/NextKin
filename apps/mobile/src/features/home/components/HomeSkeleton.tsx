import { View } from 'react-native';

import { useLayoutScale, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Skeleton } from '@/ui/Skeleton';

/** Whole-page loading state while the user record is fetched (first paint only). */
export function HomeSkeleton() {
  const { spacing } = useTheme();
  const { s } = useLayoutScale();

  return (
    <View accessibilityLabel="Loading home" accessible style={{ gap: spacing[4] }}>
      <Skeleton width="45%" height={s(53)} radius="sm" />
      <Skeleton width="70%" height={14} />
      <View style={{ flexDirection: 'row', gap: spacing[4], alignItems: 'center' }}>
        <View style={{ flex: 1, gap: spacing[2] }}>
          <Skeleton height={s(46)} radius="sm" />
          <Skeleton height={s(46)} radius="sm" />
        </View>
        <Skeleton width={s(130)} height={s(130)} radius="cardLg" />
      </View>
      <Card style={{ gap: spacing[4] }}>
        <Skeleton width="35%" height={22} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={s(60)} height={s(88)} radius="md" />
          ))}
        </View>
      </Card>
      <Skeleton width="45%" height={22} />
      <View style={{ flexDirection: 'row', gap: spacing[4] }}>
        <Skeleton width={s(288)} height={s(220)} radius="cardLg" />
        <Skeleton width={s(288)} height={s(220)} radius="cardLg" />
      </View>
      <Skeleton height={s(200)} radius="cardLg" />
      <Skeleton height={s(147)} radius="cardLg" />
    </View>
  );
}
