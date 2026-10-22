import { View } from 'react-native';

import { scaledSheet, useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';

// TAILOR 02 at 390 (607:2), in artboard units: each block the height of what replaces it.
const HERO_TEXT_W = '62%';
const HERO_TITLE = 48 / 0.75;
const HERO_LEDE = 35 / 0.75;
const RING = 86 / 0.75;
const VS_CARD = 154.5 / 0.75;
const HEADING = 21 / 0.75;
const CHIPS = 87 / 0.75;
const IMPROVE_CARD = 268.5 / 0.75;
const TEXT_GAP = 6 / 0.75;
const HERO_TO_CARD = 20 / 0.75;
const CARD_TO_SECTION = 24 / 0.75;
const SECTION_GAP = 12 / 0.75;

/**
 * The compare screen's loading state: the hero, the vs card and the two sections in their own
 * shapes, so nothing jumps when the comparison lands — never a spinner. The stepper is drawn by
 * the screen itself above this, since it does not wait on data.
 */
export function TailorCompareSkeleton({
  label = 'Comparing your resume with this job',
}: {
  /** BUILD 04b compares the profile instead. */
  label?: string;
}) {
  const { s } = useTheme();
  const styles = useStyles();
  return (
    <View accessible accessibilityLabel={label}>
      <View style={styles.hero}>
        <View style={{ width: HERO_TEXT_W, gap: s(TEXT_GAP) }}>
          <Skeleton height={s(HERO_TITLE)} />
          <Skeleton height={s(HERO_LEDE)} />
        </View>
        <Skeleton width={s(RING)} height={s(RING)} radius="full" />
      </View>
      <Skeleton height={s(VS_CARD)} radius="card" style={{ marginTop: s(HERO_TO_CARD) }} />
      <View style={[styles.section, { marginTop: s(CARD_TO_SECTION) }]}>
        <Skeleton width="40%" height={s(HEADING)} />
        <Skeleton height={s(CHIPS)} radius="card" />
      </View>
      <View style={[styles.section, { marginTop: s(CARD_TO_SECTION) }]}>
        <Skeleton width="45%" height={s(HEADING)} />
        <Skeleton height={s(IMPROVE_CARD)} radius="card" />
      </View>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: s(SECTION_GAP) },
}));
