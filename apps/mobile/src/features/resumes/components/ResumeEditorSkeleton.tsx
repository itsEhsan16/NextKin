import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/**
 * Block geometry, each one the composed height of the thing it stands in for:
 *
 * - `BADGE`   the 44pt ATS disc on the meta strip
 * - `LINE`    the "v5 · edited 2 days ago" caption (20) and the rubric link (20)
 * - `SUMMARY` a card: 2 (hairline) + 40 (padding) + label 24 + gap 16 + three 18pt prose lines
 *             and their two 8pt gaps
 * - `SKILLS`  the same card frame around two 28pt chip rows and their gap
 */
const BADGE = 44;
const LINE = 20;
const SUMMARY = 148;
const SKILLS = 138;

/**
 * The editor's loading state. Blocks shaped like the meta strip and the first two section cards,
 * so the page does not re-flow when the document lands — never a spinner. The screen pins an
 * inert `StickyActionBar` under it for the same reason: the bar owns the bottom safe-area inset,
 * so a loading page without one would resize the viewport the moment the queries settle.
 */
export function ResumeEditorSkeleton() {
  const { radii, spacing, s } = useTheme();

  return (
    <View accessible accessibilityLabel="Loading document" style={{ gap: spacing[5] }}>
      <View style={{ gap: spacing[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[4] }}>
          <Skeleton width={s(BADGE)} height={s(BADGE)} radius="full" />
          <View style={{ flex: 1, gap: spacing[2] }}>
            <Skeleton width="55%" height={s(LINE)} />
            <Skeleton width="35%" height={s(LINE)} style={{ borderRadius: radii.sm }} />
          </View>
        </View>
        <Skeleton width="45%" height={s(LINE)} />
      </View>

      <Skeleton height={s(SUMMARY)} radius="card" />
      <Skeleton height={s(SKILLS)} radius="card" />
    </View>
  );
}
