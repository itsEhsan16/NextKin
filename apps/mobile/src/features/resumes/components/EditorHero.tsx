import { View } from 'react-native';

import {
  COVER_LETTER_TONE_LABEL,
  SCORE_LABEL,
  type DocumentContent,
  type Resume,
} from '@/data/models';
import { a11yButton, a11yHeader } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Chip } from '@/ui/Chip';
import { Icon, type LineIconName } from '@/ui/Icon';
import { FlowCard } from '@/ui/kit';
import { NoteBar } from '@/ui/NoteBar';
import { Pressable } from '@/ui/Pressable';
import { ScoreRing } from '@/ui/Progress';
import { Text } from '@/ui/Text';

import { atsScoreColor } from '../docMeta';
import { versionLine } from '../editorSections';
import { DocTypePill, UpdateAvailablePill } from './DocPills';

export type EditorHeroProps = {
  resume: Resume;
  content?: DocumentContent;
  /** The AI note under the document row — how many quick wins are left. Omitted when unscored. */
  note?: string;
  onOpenScore: () => void;
  onOpenRubric: () => void;
  onOpenVersions: () => void;
};

// RESUMES 06 hero at 390 (577:6939), in artboard units.
/** The ring beside the title, at 390. */
const RING = 92;
const RING_STROKE = 8;

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
/** A soft action pill under the card: "See what changed", "How it's scored". */
function HeroAction({
  icon,
  label,
  a11y,
  hint,
  onPress,
}: {
  icon: LineIconName;
  label: string;
  a11y: string;
  hint: string;
  onPress: () => void;
}) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      {...a11yButton(a11y, hint)}
      feedback="subtle"
      haptic="selection"
      onPress={onPress}
      style={[styles.action, { backgroundColor: colors.brandSurface }]}
    >
      <Icon name={icon} size={u(16)} color={colors.brand} />
      <Text variant="footnote" color="brand">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The top of the editor (RESUMES 06, redesigned §177): one card with the document's name, its
 * version and type, and its ATS score as a ring that opens the breakdown; the AI's note under it.
 * Two pills below the card: the versions, and the rubric whenever there is a score (§7.8).
 */
export function EditorHero({
  resume,
  content,
  note,
  onOpenScore,
  onOpenRubric,
  onOpenVersions,
}: EditorHeroProps) {
  const { u } = useTheme();
  const styles = useStyles();
  const score = resume.atsScore;

  return (
    <View style={styles.wrap}>
      <FlowCard style={styles.card}>
        <View style={styles.document}>
          <View style={styles.text}>
            <Text {...a11yHeader()} variant="title2" color="ink" numberOfLines={2}>
              {resume.title}
            </Text>
            <Text variant="footnote" color="textSecondary">
              {versionLine(resume)}
            </Text>
            <View style={styles.pills}>
              <DocTypePill resume={resume} />
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
                  valueText={String(Math.round(score))}
                  label="ATS score"
                  size={u(RING)}
                  strokeWidth={u(RING_STROKE)}
                  ringColor={atsScoreColor(score)}
                  trackColor="surfaceSubtle"
                  numberVariant="title1"
                  numberColor="textPrimary"
                  labelVariant="tiny"
                  labelColor="textSecondary"
                />
              </View>
            </Pressable>
          ) : (
            <Text variant="footnote" color="textTertiary">
              Not scored yet
            </Text>
          )}
        </View>

        {score == null && content?.kind !== 'cover_letter' ? (
          <Text variant="footnote" color="textSecondary">
            {NO_SCORE_WHY}
          </Text>
        ) : null}

        {note ? <NoteBar text={note} /> : null}
      </FlowCard>

      <View style={styles.actions}>
        <HeroAction
          icon="ClockRewind"
          label="See what changed"
          a11y="See what changed"
          hint="Opens this resume’s versions"
          onPress={onOpenVersions}
        />
        {score != null ? (
          <HeroAction
            icon="BookOpen01"
            label="How it’s scored"
            a11y="What this score measures"
            hint={`Opens the rubric behind the ${SCORE_LABEL}`}
            onPress={onOpenRubric}
          />
        ) : null}
      </View>
    </View>
  );
}

const useStyles = scaledSheet((_s, u) => ({
  wrap: { gap: u(12) },
  card: { gap: u(14), padding: u(20) },
  document: { flexDirection: 'row', alignItems: 'center', gap: u(14) },
  text: { flex: 1, gap: u(4) },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: u(6),
    marginTop: u(4),
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: u(10) },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: u(6),
    height: u(40),
    paddingHorizontal: u(14),
    borderRadius: u(999),
  },
}));
