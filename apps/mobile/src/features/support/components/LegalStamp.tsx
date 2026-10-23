import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import { formatShortDate } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

// Under the legal hero's title at 390 (LEGAL 01 577:8905 … 577:8909), in artboard units.
const TITLE_TO_PILL = 8 / 0.75;
const PILL_PAD_LEFT = 9 / 0.75;
const PILL_PAD_RIGHT = 10 / 0.75;
const PILL_PAD_Y = 4 / 0.75;
const PILL_GAP = 5 / 0.75;
const PILL_ICON = 9.5 / 0.75;
const PILL_TO_INTRO = 12 / 0.75;
/** The intro is inset inside the hero (577:8909). */
const INTRO_INSET = 18 / 0.75;
/** Skeleton stand-ins: the 23pt pill, then two caption lines. */
const PILL_SKELETON_W = 145 / 0.75;
const PILL_SKELETON_H = 23 / 0.75;
const LINE = 17 / 0.75;
const LINE_GAP = 4 / 0.75;

/**
 * §8.5's "Last updated" stamp as a pill, then the document's one-paragraph intro, centred under
 * the hero title. While loading, the same shapes as skeleton blocks so the page does not reflow.
 */
export function LegalStamp({ updatedAt, intro }: { updatedAt?: string; intro?: string }) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();

  if (updatedAt === undefined || intro === undefined) {
    return (
      <View style={styles.skeleton}>
        <Skeleton width={s(PILL_SKELETON_W)} height={s(PILL_SKELETON_H)} radius="full" />
        <View style={[styles.intro, styles.skeletonLines]}>
          <Skeleton height={s(LINE)} />
          <Skeleton width="70%" height={s(LINE)} />
        </View>
      </View>
    );
  }

  return (
    <>
      <View
        style={[styles.pill, { borderRadius: radii.full, backgroundColor: colors.surfaceSubtle }]}
      >
        <FontAwesome5 name="calendar" size={s(PILL_ICON)} color={colors.textBody} solid />
        <Text variant="microBadge" color="textBody">
          {`Last updated ${formatShortDate(updatedAt)}`}
        </Text>
      </View>
      <Text
        variant="captionRegular"
        color="textSecondary"
        align="center"
        selectable
        style={styles.intro}
      >
        {intro}
      </Text>
    </>
  );
}

const useStyles = scaledSheet((s) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(PILL_GAP),
    paddingLeft: s(PILL_PAD_LEFT),
    paddingRight: s(PILL_PAD_RIGHT),
    paddingVertical: s(PILL_PAD_Y),
    marginTop: s(TITLE_TO_PILL),
  },
  intro: { marginTop: s(PILL_TO_INTRO), paddingHorizontal: s(INTRO_INSET) },
  skeleton: { alignSelf: 'stretch', alignItems: 'center', marginTop: s(TITLE_TO_PILL) },
  skeletonLines: { alignSelf: 'stretch', alignItems: 'center', gap: s(LINE_GAP) },
}));
