import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import type { JdDraft } from '@/data/models';
import { ProfileCard } from '@/features/profile/components/cards';
import { a11yButton, hitSlopFor, initialOf, pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Pressable } from '@/ui/Pressable';
import { Text } from '@/ui/Text';

export type BuildReviewCardProps = {
  draft: JdDraft;
  /** Every skill the job asks for, once: `profileKeywordFit(draft, [])` order. */
  asks: readonly string[];
  /** The pencil: opens the full JD review to correct what was read. */
  onEdit: () => void;
};

// "Job card" at 390 (653:76), in artboard units.
const HEAD_PAD_X = 15 / 0.75;
const HEAD_PAD_Y = 14 / 0.75;
const HEAD_GAP = 12 / 0.75;
const TILE = 42 / 0.75; // 653:79
const TILE_RADIUS = 13 / 0.75;
const TEXT_GAP = 2 / 0.75;
const PENCIL = 13 / 0.75;
const RULE = 1 / 0.75;
const ASKS_PAD_TOP = 14 / 0.75; // 653:85
const ASKS_PAD_BOTTOM = 15 / 0.75;
const ASKS_GAP = 10 / 0.75;
const CHIP_PAD_LEFT = 11 / 0.75; // 653:92
const CHIP_PAD_RIGHT = 12 / 0.75;
const CHIP_PAD_Y = 6 / 0.75;
const CHIP_GAP_X = 7 / 0.75;
const CHIP_GAP_Y = 8 / 0.75;

/** "CRED · Bengaluru" — only the parts the extraction found (a JD draft keeps no workplace). */
export const draftMetaLine = (draft: JdDraft): string =>
  [draft.company, draft.location].filter(Boolean).join(' · ');

/**
 * BUILD 04's card (653:76): the job as read — the dark letter tile, title, where — with a pencil to
 * correct it, then "What the job asks for" as plain grey chips. Nothing is measured against the
 * profile yet: that is BUILD 04b's job, after "Compare with my profile".
 */
export function BuildReviewCard({ draft, asks, onEdit }: BuildReviewCardProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();
  const meta = draftMetaLine(draft);
  const name = draft.company ?? draft.title;

  return (
    <ProfileCard style={styles.card}>
      <View style={styles.head}>
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[styles.tile, { backgroundColor: colors.surfaceInverse }]}
        >
          <Text variant="logoInitial" color="textOnDark">
            {initialOf(name)}
          </Text>
        </View>
        <View
          accessible
          accessibilityLabel={meta ? `${draft.title}, ${meta}` : draft.title}
          style={styles.text}
        >
          <Text variant="title" numberOfLines={2}>
            {draft.title}
          </Text>
          {meta ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        <Pressable
          {...a11yButton('Edit the job details', 'Correct what we read from the job')}
          feedback="scale"
          haptic="light"
          hitSlop={hitSlopFor(s(PENCIL))}
          onPress={onEdit}
        >
          <FontAwesome5 name="pen" size={s(PENCIL)} color={colors.iconDefault} solid />
        </Pressable>
      </View>

      <View style={[styles.rule, { backgroundColor: colors.divider }]} />

      <View style={styles.asks}>
        <Text variant="bodyMedium">
          {asks.length > 0
            ? `What the job asks for · ${pluralize(asks.length, 'thing')}`
            : 'What the job asks for'}
        </Text>
        {asks.length > 0 ? (
          <View style={styles.chips}>
            {asks.map((label) => (
              <View
                key={label}
                style={[
                  styles.chip,
                  { borderRadius: radii.full, backgroundColor: colors.surfaceSubtle },
                ]}
              >
                <Text variant="caption" color="textBody" numberOfLines={1}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text variant="micro" color="textSecondary">
            We didn&apos;t find any skills in this job. Your resume will follow its description.
          </Text>
        )}
      </View>
    </ProfileCard>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { padding: 0, overflow: 'hidden' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(HEAD_GAP),
    paddingHorizontal: s(HEAD_PAD_X),
    paddingVertical: s(HEAD_PAD_Y),
  },
  tile: {
    width: s(TILE),
    height: s(TILE),
    borderRadius: s(TILE_RADIUS),
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: s(TEXT_GAP) },
  rule: { height: s(RULE) },
  asks: {
    paddingHorizontal: s(HEAD_PAD_X),
    paddingTop: s(ASKS_PAD_TOP),
    paddingBottom: s(ASKS_PAD_BOTTOM),
    gap: s(ASKS_GAP),
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: s(CHIP_GAP_X),
    rowGap: s(CHIP_GAP_Y),
  },
  chip: {
    paddingLeft: s(CHIP_PAD_LEFT),
    paddingRight: s(CHIP_PAD_RIGHT),
    paddingVertical: s(CHIP_PAD_Y),
  },
}));
