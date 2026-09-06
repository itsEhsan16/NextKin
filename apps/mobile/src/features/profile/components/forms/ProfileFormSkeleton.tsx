import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/** Artboard lengths for the placeholder blocks; every one is projected through `s()` below. */
const LABEL = 16;
const FIELD = 52;
const ROWS = 116;

/**
 * The shape of the entry form that is coming (V2 §7.3). All four forms open on two text fields
 * over a carded pair of rows, so one wait serves them all rather than four that differ by a
 * block nobody can read yet.
 */
export function ProfileFormSkeleton() {
  const { radii, spacing, s } = useTheme();

  return (
    <View
      accessible
      accessibilityLabel="Loading this entry"
      accessibilityRole="progressbar"
      style={{ gap: spacing[5] }}
    >
      <View style={{ gap: spacing[2] }}>
        <Skeleton width="32%" height={s(LABEL)} />
        <Skeleton height={s(FIELD)} radius="xl" />
      </View>
      <View style={{ gap: spacing[2] }}>
        <Skeleton width="26%" height={s(LABEL)} />
        <Skeleton height={s(FIELD)} radius="xl" />
      </View>
      <Skeleton height={s(ROWS)} style={{ borderRadius: radii.card }} />
    </View>
  );
}
