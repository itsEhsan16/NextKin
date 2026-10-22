import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { View } from 'react-native';

import type { TailorChoices, TailorKeyword } from '@/data/models';
import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import { pluralize } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { OptionSheetHeader } from '@/ui/OptionSheet';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';

import { buildCostNote, spentNote } from '../generationQuota';
import { AddSkipToggle, type TailorChoice } from './AddSkipToggle';

export type AddKeywordsSheetBodyProps = {
  /**
   * 'tailor' starts a tailored resume (TAILOR 03); 'build' builds one from the profile (BUILD
   * 04c), where what is added also goes on the profile, and the cost is a resume build.
   */
  variant?: 'tailor' | 'build';
  company: string;
  keywords: readonly TailorKeyword[];
  /** The answer each keyword holds now, by label. */
  choiceFor: (keyword: TailorKeyword) => TailorChoice;
  onChoose: (keyword: TailorKeyword, choice: TailorChoice) => void;
  /** This month's generations, from `useSubscription()` (V2 §13.5: say the limit before the work). */
  used: number;
  limit: number;
  busy: boolean;
  /** Why the last start failed, shown where the quota line sits. */
  failure?: string;
  onCreate: () => void;
  onUpgrade: () => void;
  onClose: () => void;
};

// TAILOR 03 at 390 (608:141), in artboard units.
const TOP = 16 / 0.75; // handle → header: the board's 30 less the handle and its margin
const BOTTOM = 30 / 0.75;
const HEADER_TO_ROWS = 14 / 0.75;
const ROW_GAP = 8 / 0.75;
const ROW_RADIUS = 15 / 0.75;
const ROW_PAD_LEFT = 14 / 0.75;
const ROW_PAD_RIGHT = 10 / 0.75;
const ROW_PAD_Y = 11 / 0.75;
const ROW_INNER_GAP = 12 / 0.75;
const ROW_TEXT_GAP = 2 / 0.75;
const ROWS_TO_NOTE = 14 / 0.75;
const NOTE_PAD_LEFT = 4 / 0.75;
const NOTE_GAP = 8 / 0.75;
const NOTE_GLYPH = 12 / 0.75;
const NOTE_TO_CTA = 20 / 0.75;
const CTA_TO_QUOTA = 10 / 0.75;
const SPARKLE_W = 18 / 0.75;
const SPARKLE_H = 17.6315 / 0.75;

/** "Add this…" for one keyword (BUILD 04c draws one), "Add these…" for more. */
const titleFor = (count: number): string =>
  count === 1 ? 'Add this to your resume?' : 'Add these to your resume?';
/** BUILD 04c (663:254) says why the keyword is asked about: it is not on the profile. */
function subtitleFor(variant: 'tailor' | 'build', company: string, count: number): string {
  if (variant === 'build') {
    return count === 1
      ? `${company} asks for it, but it isn’t on your profile. Only add it if you really have it.`
      : `${company} asks for them, but they aren’t on your profile. Only add the ones you really have.`;
  }
  return count === 1
    ? `${company} asks for it. Only add it if you really have it.`
    : `${company} asks for them. Only add the ones you really have.`;
}
/**
 * V2 §7.7: whatever is added is something the user can be asked about. A build writes what is
 * added to the profile as well, so BUILD 04c (663:293) says that instead.
 */
const NOTE = {
  tailor: 'Interviewers may ask about anything on your resume.',
  build: 'Anything you add is saved to your profile too.',
} as const;
const CTA = { tailor: 'Create my resume', build: 'Build my resume' } as const;

/** The line under a keyword: where in the listing the ask came from. */
export const keywordSource = (keyword: TailorKeyword, company: string): string =>
  keyword.source === 'required' ? `Required by ${company}` : 'In the role description';

/**
 * The default answer, so no row starts undecided: a skill the listing REQUIRES stays out until the
 * user says they have it (V2 §7.8 — never claim what the profile can't back), while wording from
 * the role description goes in. TAILOR 03 draws exactly this for the Stripe example.
 */
export const defaultChoice = (keyword: TailorKeyword): TailorChoice =>
  keyword.source === 'required' ? 'skip' : 'add';

/** The answers as the run takes them. */
export function collectChoices(
  keywords: readonly TailorKeyword[],
  choiceFor: (keyword: TailorKeyword) => TailorChoice,
): TailorChoices {
  const added: string[] = [];
  const skipped: string[] = [];
  for (const keyword of keywords) {
    (choiceFor(keyword) === 'add' ? added : skipped).push(keyword.label);
  }
  return { added, skipped };
}

/** The sheet's content alone, testable without the Sheet's gestures and animation. */
export function AddKeywordsSheetBody({
  variant = 'tailor',
  company,
  keywords,
  choiceFor,
  onChoose,
  used,
  limit,
  busy,
  failure,
  onCreate,
  onUpgrade,
  onClose,
}: AddKeywordsSheetBodyProps) {
  const { colors, s, sizes, spacing } = useTheme();
  const styles = useStyles();
  const spent = used >= limit;
  // UsageBanner's wording, so the line reads the same here as on every other create screen.
  const quota = spent
    ? spentNote(limit)
    : variant === 'build'
      ? buildCostNote(limit)
      : `${Math.max(0, limit - used)} of ${pluralize(limit, 'generation')} left this month`;

  return (
    <View style={[styles.body, { paddingHorizontal: spacing.gutter }]}>
      <OptionSheetHeader
        variant="card"
        title={titleFor(keywords.length)}
        subtitle={subtitleFor(variant, company, keywords.length)}
        onClose={onClose}
      />

      <View style={styles.rows}>
        {keywords.map((keyword) => {
          const choice = choiceFor(keyword);
          return (
            <View
              key={keyword.label}
              style={[
                styles.row,
                {
                  borderWidth: sizes.border,
                  borderColor: choice === 'add' ? colors.brandBorder : colors.borderDefault,
                  backgroundColor: colors.surfaceCard,
                },
              ]}
            >
              <View style={styles.rowText}>
                <Text variant="menuRow">{keyword.label}</Text>
                <Text variant="micro" color="textSecondary">
                  {keywordSource(keyword, company)}
                </Text>
              </View>
              <AddSkipToggle
                keyword={keyword.label}
                value={choice}
                onChange={(next) => onChoose(keyword, next)}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.note}>
        <FontAwesome5 name="info-circle" size={s(NOTE_GLYPH)} color={colors.iconMuted} solid />
        <Text variant="micro" color="textSecondary" style={styles.noteText}>
          {NOTE[variant]}
        </Text>
      </View>

      <Button
        size="lg"
        block
        style={styles.cta}
        {...(spent
          ? { label: 'See Pro plans', onPress: onUpgrade }
          : {
              label: CTA[variant],
              leading: <SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />,
              loading: busy,
              onPress: onCreate,
            })}
      />
      <Text
        variant="micro"
        color="textSecondary"
        align="center"
        accessibilityLiveRegion="polite"
        style={styles.quota}
      >
        {failure ?? quota}
      </Text>
    </View>
  );
}

export type AddKeywordsSheetProps = AddKeywordsSheetBodyProps & { open: boolean };

/** TAILOR 03 (608:2) / BUILD 04c (663:249): add or skip each missing keyword, then start the run. */
export function AddKeywordsSheet({ open, ...body }: AddKeywordsSheetProps) {
  const { sizes } = useTheme();
  return (
    <Sheet
      open={open}
      onClose={body.onClose}
      height={sizes.sheetPickerHeight}
      accessibilityLabel={titleFor(body.keywords.length)}
    >
      <AddKeywordsSheetBody {...body} />
    </Sheet>
  );
}

const useStyles = scaledSheet((s) => ({
  body: { paddingTop: s(TOP), paddingBottom: s(BOTTOM) },
  rows: { marginTop: s(HEADER_TO_ROWS), gap: s(ROW_GAP) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(ROW_INNER_GAP),
    borderRadius: s(ROW_RADIUS),
    paddingLeft: s(ROW_PAD_LEFT),
    paddingRight: s(ROW_PAD_RIGHT),
    paddingVertical: s(ROW_PAD_Y),
  },
  rowText: { flex: 1, gap: s(ROW_TEXT_GAP) },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(NOTE_GAP),
    paddingLeft: s(NOTE_PAD_LEFT),
    marginTop: s(ROWS_TO_NOTE),
  },
  noteText: { flex: 1 },
  cta: { marginTop: s(NOTE_TO_CTA) },
  quota: { marginTop: s(CTA_TO_QUOTA) },
}));
