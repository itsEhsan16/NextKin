import { View } from 'react-native';

import { useTheme } from '@/theme';
import { SkeletonBlock } from '@/ui/Skeleton';

/**
 * Home's sections at 390, measured from the loaded page (§191): Quick Start, Top Job Matches,
 * the shortcut grid and Your Resume Progress. One block each, the section's own height, so the
 * dashboard lands without anything moving.
 */
const SECTIONS = [149, 228, 102, 175] as const;
/** HomeScreen's SECTION_GAP: the blocks stand where the sections will. */
const SECTION_GAP = 20;

/** Home's loading state while the user record is fetched (first paint only). */
export function HomeSkeleton() {
  const { s, u } = useTheme();
  return (
    <View accessibilityLabel="Loading home" accessible style={{ gap: s(SECTION_GAP) }}>
      {SECTIONS.map((height, index) => (
        <SkeletonBlock key={index} height={u(height)} />
      ))}
    </View>
  );
}
