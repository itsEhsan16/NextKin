import { View } from 'react-native';

import { useTheme } from '@/theme';
import { SkeletonBlock, SkeletonRow } from '@/ui/Skeleton';

import { ResumeProgressSkeleton } from './ResumeProgressSkeleton';
import { SectionHeadingSkeleton } from './SectionHeadingSkeleton';

/**
 * Home's sections at 390, measured from the loaded page (§191): Quick Start, Top Job Matches,
 * the shortcut grid and Your Resume Progress. Each keeps its own height, so the dashboard lands
 * without anything moving.
 */
const QUICK_START_H = 149;
const SHORTCUTS_H = 102;
/** TopJobMatches' card and gap at 390 (its CARD_WIDTH / CARD_GAP / MATCH_CARD_H). */
const MATCH = { width: 288, height: 191, gap: 16 } as const;
/** HomeScreen's SECTION_GAP: the shapes stand where the sections will. */
const SECTION_GAP = 20;

/**
 * Home's first paint (§196): the dashboard's silhouette — the Quick Start card, the matches
 * heading over two match cards running off the edge, the shortcut card and the progress card
 * traced as thumbnail, lines and ring. A few large shapes, lit as one surface by the shimmer.
 */
export function HomeSkeleton() {
  const { s, u, spacing } = useTheme();
  return (
    <View accessibilityLabel="Loading home" accessible style={{ gap: s(SECTION_GAP) }}>
      <SkeletonBlock height={u(QUICK_START_H)} />
      <View style={{ gap: spacing[4] }}>
        <SectionHeadingSkeleton />
        <SkeletonRow gap={s(MATCH.gap)}>
          <SkeletonBlock width={s(MATCH.width)} height={u(MATCH.height)} />
          <SkeletonBlock width={s(MATCH.width)} height={u(MATCH.height)} />
        </SkeletonRow>
      </View>
      <SkeletonBlock height={u(SHORTCUTS_H)} />
      <ResumeProgressSkeleton framed />
    </View>
  );
}
