import { View } from 'react-native';

import {
  COVER_LETTER_TONE_LABEL,
  SCORE_LABEL,
  type DocumentContent,
  type Resume,
} from '@/data/models';
import { ProfileCard } from '@/features/profile/components/cards';
import { a11yButton, a11yHeader, hitSlopFor } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Chip } from '@/ui/Chip';
import { NoteBar } from '@/ui/NoteBar';
import { Pressable } from '@/ui/Pressable';
import { ScoreRing } from '@/ui/Progress';
import { Text } from '@/ui/Text';

import { atsScoreColor } from '../docMeta';
import { versionLine } from '../editorSections';
import { DocTypePill, UpdateAvailablePill } from './DocPills';
import { ResumeThumbnail } from './ResumeThumbnail';
import { Icon } from '@/ui/Icon';

export type EditorHeroProps = {
  resume: Resume;
  content?: DocumentContent;
  /** The AI note under the document row — how many quick wins are left. Omitted when unscored. */
  note?: string;
  onOpenScore: () => void;
  onOpenRubric: () => void;
};

// RESUMES 06 hero at 390 (577:6939), in artboard units.
const GAP = 14 / 0.75;
const THUMB_W = 64 / 0.75;
const THUMB_H = 62.745 / 0.75;
const THUMB_RADIUS = 3.137 / 0.75;
const TEXT_GAP = 3 / 0.75;
const PILL_TOP = 5 / 0.75;
const PILL_PAD_LEFT = 9 / 0.75;
const PILL_PAD_RIGHT = 10 / 0.75;
const PILL_PAD_Y = 4 / 0.75;
const RING = 64 / 0.75;
const RING_STROKE = 4.8 / 0.75;
const LINK_GAP = 4.5 / 0.75;
/** The rubric link is one 16pt line, padded out to the 44pt floor. */
const LINK_HEIGHT = 16 / 0.75;

/** A score is always against a job (D-15), and the page says so (WhyNextKin.md §4.2). */
const NO_SCORE_WHY = 'Add a job to see a score. We don’t guess.';

/**
 * The card at the top of the editor (RESUMES 06): the page thumbnail, the document's name and
 * history, its type pill and the score ring, then the AI note and the rubric link (V2 §7.8 —
 * every score display links the published rubric). The ring opens the score panel.
 *
 * An unscored draft is normal rather than broken, so it shows no ring, note or link rather than
 * a zero, and says what a score needs (D-15). A cover letter's tone is shown read-only: rewriting
 * it spends a generation (§13.5).
 */
export function EditorHero({ resume, content, note, onOpenScore, onOpenRubric }: EditorHeroProps) {
  const { colors, radii, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const score = resume.atsScore;

  return (
    <ProfileCard style={[styles.card, { padding: spacing[5] }]}>
      <View style={styles.document}>
        <View
          style={[styles.thumb, { borderWidth: sizes.border, borderColor: colors.borderDefault }]}
        >
          <ResumeThumbnail style={styles.fill} />
        </View>

        <View style={styles.text}>
          <Text {...a11yHeader()} variant="cardTitle" numberOfLines={2}>
            {resume.title}
          </Text>
          <Text variant="micro" color="textSecondary">
            {versionLine(resume)}
          </Text>
          <View style={styles.pills}>
            <DocTypePill resume={resume} style={styles.pill} />
            {resume.updateAvailable ? <UpdateAvailablePill announce /> : null}
            {content?.kind === 'cover_letter' ? (
              <Chip label={COVER_LETTER_TONE_LABEL[content.tone]} />
            ) : null}
          </View>
        </View>

        {score != null ? (
          <Pressable
            {...a11yButton(`${SCORE_LABEL} ${score}`, 'Opens the score breakdown')}
            feedback="scale"
            haptic="light"
            onPress={onOpenScore}
          >
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <ScoreRing
                score={score}
                label="ATS Score"
                size={s(RING)}
                strokeWidth={s(RING_STROKE)}
                ringColor={atsScoreColor(score)}
                trackColor="borderDefault"
                numberVariant="editorRingValue"
                numberColor="textPrimary"
                labelVariant="ringCaption"
                labelColor="textSecondary"
              />
            </View>
          </Pressable>
        ) : (
          // An unscored draft is normal, so its absence is stated quietly, never drawn as a zero.
          <Text variant="micro" color="textTertiary">
            Not scored yet
          </Text>
        )}
      </View>

      {score == null && content?.kind !== 'cover_letter' ? (
        <Text variant="micro" color="textSecondary">
          {NO_SCORE_WHY}
        </Text>
      ) : null}

      {note ? <NoteBar text={note} /> : null}

      {score != null ? (
        <>
          <View style={[styles.rule, { backgroundColor: colors.divider }]} />
          <Pressable
            {...a11yButton(
              'What this score measures',
              `Opens the rubric behind the ${SCORE_LABEL}`,
            )}
            feedback="subtle"
            haptic="selection"
            hitSlop={hitSlopFor(s(LINK_HEIGHT))}
            onPress={onOpenRubric}
            style={[styles.link, { borderRadius: radii.xs }]}
          >
            <Text variant="captionSemiBold" color="brand">
              What this score measures
            </Text>
            <Icon name="ChevronRight" size="sm" color={colors.brand} />
          </Pressable>
        </>
      ) : null}
    </ProfileCard>
  );
}

const useStyles = scaledSheet((s) => ({
  card: { gap: s(GAP) },
  document: { flexDirection: 'row', alignItems: 'center', gap: s(GAP) },
  thumb: {
    width: s(THUMB_W),
    height: s(THUMB_H),
    borderRadius: s(THUMB_RADIUS),
    overflow: 'hidden',
  },
  fill: { flex: 1 },
  text: { flex: 1, gap: s(TEXT_GAP) },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: s(6 / 0.75),
    marginTop: s(PILL_TOP),
  },
  pill: {
    paddingLeft: s(PILL_PAD_LEFT),
    paddingRight: s(PILL_PAD_RIGHT),
    paddingVertical: s(PILL_PAD_Y),
  },
  rule: { height: s(1 / 0.75) },
  link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: s(LINK_GAP) },
}));
