import { StyleSheet, View } from 'react-native';

import type { EditableSectionKey } from '@/data/models';
import { useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

/** Artboard lengths for the placeholder blocks; every one is projected through `s()` below. */
const LABEL = 16;
const FIELD = 52;
const TEXTAREA = 160;
const CHIP = 32;
const CARD = 240;
const CHIP_WIDTHS = [96, 132, 78, 110, 88];

/**
 * The shape of the body that is coming (V2 §7.11). Keyed off the route's section rather than the
 * loaded content, because the section is known a frame before the document is — so the page never
 * shows a summary-shaped wait and then swaps in three cards.
 */
export function SectionSkeleton({ section }: { section: EditableSectionKey }) {
  const { radii, spacing, s } = useTheme();

  if (section === 'summary') {
    return (
      <View style={{ gap: spacing[3] }}>
        <Skeleton width="35%" height={s(LABEL)} />
        <Skeleton height={s(TEXTAREA)} radius="xl" />
      </View>
    );
  }

  if (section === 'skills' || section === 'certifications') {
    return (
      <View style={{ gap: spacing[3] }}>
        <Skeleton width="30%" height={s(LABEL)} />
        <View style={[styles.chips, { gap: spacing[2] }]}>
          {CHIP_WIDTHS.map((width) => (
            <Skeleton key={width} width={s(width)} height={s(CHIP)} radius="full" />
          ))}
        </View>
        <Skeleton height={s(FIELD)} radius="xl" />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <Skeleton height={s(CARD)} style={{ borderRadius: radii.card }} />
      <Skeleton height={s(CARD)} style={{ borderRadius: radii.card }} />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
