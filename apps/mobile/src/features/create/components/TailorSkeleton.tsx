import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/** Block geometry: the usage banner, the base-resume row, and the card of three choices. */
const BANNER = 78;
const LABEL = 18;
const ROW = 74;
const CHOICES = 232;

/**
 * The tailor intake's loading state. Blocks in the shape of the content that replaces them, so
 * nothing jumps when the resumes and the subscription land — never a spinner.
 */
export function TailorSkeleton() {
  const { spacing, s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading tailor setup" style={{ gap: spacing[6] }}>
      <Skeleton height={s(BANNER)} radius="card" />
      <View style={{ gap: spacing[3] }}>
        <Skeleton width="35%" height={s(LABEL)} />
        <Skeleton height={s(ROW)} radius="card" />
      </View>
      <View style={{ gap: spacing[3] }}>
        <Skeleton width="45%" height={s(LABEL)} />
        <Skeleton height={s(CHOICES)} radius="card" />
      </View>
    </View>
  );
}
