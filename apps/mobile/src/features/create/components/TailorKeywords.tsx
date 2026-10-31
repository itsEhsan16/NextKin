import { View, type StyleProp, type ViewStyle } from 'react-native';

import type { TailorKeyword } from '@/data/models';
import { a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Text } from '@/ui/Text';
import { Icon } from '@/ui/Icon';

export type TailorKeywordsProps = {
  keywords: readonly TailorKeyword[];
  /** What the keywords are measured against: the resume (TAILOR 02) or the profile (BUILD 04b). */
  subject?: 'resume' | 'profile';
};

/** One chip: green with a tick when it is there, amber dashed with a "!" when it is not. */
export type KeywordChipItem = { label: string; have: boolean };

export type KeywordChipsProps = {
  items: readonly KeywordChipItem[];
  /** Read after each label: "on your resume" / "on your profile". */
  haveLabel?: string;
  missingLabel?: string;
  style?: StyleProp<ViewStyle>;
};

// TAILOR 02 keywords at 390 (607:65 / 607:68), in artboard units.
const HEADING_GAP = 8 / 0.75;
const HEADING_TO_CHIPS = 12 / 0.75;
const CHIP_GAP_X = 6 / 0.75;
const CHIP_GAP_Y = 7 / 0.75;
const CHIP_PAD_LEFT = 9 / 0.75;
const CHIP_PAD_RIGHT = 10 / 0.75;
const CHIP_PAD_Y = 4 / 0.75;
const CHIP_ICON_GAP = 5 / 0.75;
const CHECK = 9.5 / 0.75;
const BANG = 9 / 0.75;
const DASH = 1 / 0.75;
const CHIPS_TO_NOTE = 10 / 0.75;

/** The chip's drawn metrics, for the tappable chips of the Customize screen (toreview §114). */
export const KEYWORD_CHIP = {
  gapX: CHIP_GAP_X,
  gapY: CHIP_GAP_Y,
  padLeft: CHIP_PAD_LEFT,
  padRight: CHIP_PAD_RIGHT,
  padY: CHIP_PAD_Y,
  iconGap: CHIP_ICON_GAP,
  check: CHECK,
  bang: BANG,
  dash: DASH,
  headingGap: HEADING_GAP,
  headingToChips: HEADING_TO_CHIPS,
  chipsToNote: CHIPS_TO_NOTE,
} as const;

/** V2 §7.8: a keyword the resume does not have is never written in without the user's yes. */
export const MISSING_NOTE = 'Missing ones are only added if you say you have them.';

/**
 * "Job keywords" (TAILOR 02): the count of the job's keywords already on the resume in an amber
 * pill, then every keyword as a chip — green with a tick when the resume has it, amber dashed with
 * a "!" when it does not — and the one honest line about what happens to the missing ones.
 */
export function TailorKeywords({ keywords, subject = 'resume' }: TailorKeywordsProps) {
  const { colors, radii } = useTheme();
  const styles = useStyles();
  const covered = keywords.filter((keyword) => keyword.onResume).length;

  return (
    <View>
      <View style={styles.heading}>
        <Text {...a11yHeader()} variant="title" style={styles.fill}>
          Job keywords
        </Text>
        <View
          style={[
            styles.chip,
            { borderRadius: radii.full, backgroundColor: colors.warningSurface },
          ]}
        >
          <Text variant="microBadge" color="warningStrong" numberOfLines={1}>
            {`${covered} of ${keywords.length} on your ${subject}`}
          </Text>
        </View>
      </View>

      <KeywordChips
        items={keywords.map((keyword) => ({ label: keyword.label, have: keyword.onResume }))}
        haveLabel={`on your ${subject}`}
        style={styles.chipsGap}
      />

      <Text variant="micro" color="textSecondary" style={styles.note}>
        {MISSING_NOTE}
      </Text>
    </View>
  );
}

const useStyles = scaledSheet((s) => ({
  heading: { flexDirection: 'row', alignItems: 'center', gap: s(HEADING_GAP) },
  fill: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chipsGap: { marginTop: s(HEADING_TO_CHIPS) },
  chip: {
    paddingLeft: s(CHIP_PAD_LEFT),
    paddingRight: s(CHIP_PAD_RIGHT),
    paddingVertical: s(CHIP_PAD_Y),
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: s(CHIP_ICON_GAP) },
  note: { marginTop: s(CHIPS_TO_NOTE) },
}));

/** The keyword chips alone, for any card that measures a job's keywords against something. */
export function KeywordChips({
  items,
  haveLabel = 'on your resume',
  missingLabel = 'missing',
  style,
}: KeywordChipsProps) {
  const { colors, radii, s } = useTheme();
  const styles = useStyles();

  return (
    <View style={[styles.chips, { columnGap: s(CHIP_GAP_X), rowGap: s(CHIP_GAP_Y) }, style]}>
      {items.map((item) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.label}, ${item.have ? haveLabel : missingLabel}`}
          style={[
            styles.chipRow,
            {
              borderRadius: radii.full,
              paddingLeft: s(CHIP_PAD_LEFT),
              paddingRight: s(CHIP_PAD_RIGHT),
              paddingVertical: s(CHIP_PAD_Y),
            },
            item.have
              ? { backgroundColor: colors.successSurface }
              : {
                  backgroundColor: colors.surfaceCard,
                  borderWidth: s(DASH),
                  borderStyle: 'dashed',
                  borderColor: colors.warningAccent,
                },
          ]}
        >
          <Icon
            name={item.have ? 'Check' : 'AlertCircle'}
            size="xs"
            color={item.have ? colors.glyphSuccess : colors.warningStrong}
          />
          <Text
            variant="microBadge"
            color={item.have ? 'glyphSuccess' : 'warningStrong'}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
