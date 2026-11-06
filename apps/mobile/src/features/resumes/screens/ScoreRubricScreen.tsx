import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import AtsCheckArt from '../../../../assets/icons/create/ats-check.svg';
import FormattingIcon from '../../../../assets/icons/score/formatting.svg';
import KeywordMatchIcon from '../../../../assets/icons/score/keyword-match.svg';
import QuantifiedIcon from '../../../../assets/icons/score/quantified.svg';
import { SCORE_HONESTY_NOTE, SCORE_LABEL, SCORE_RUBRIC } from '@/data/models';
import { useResume } from '@/data/queries';
import { PROFILE_ROW_ART } from '@/features/profile/profileRowArt';
import { a11yHeader, useReducedMotion } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import type { ListRowArt } from '@/ui/ListRow';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';

import { RubricCard } from '../components/RubricCard';
import { useResumesActions } from '../hooks/useResumesActions';

export type ScoreRubricScreenProps = { id: string };

// RESUMES 10 at 390 (580:580), in artboard units.
const HEADER_TO_HERO = 10 / 0.75;
const HERO_ART_W = 72 / 0.75;
const HERO_ART_H = 70.1591 / 0.75;
const ART_TO_TITLE = 14 / 0.75;
const TITLE_TO_CAPTION = 8 / 0.75;
const HERO_TO_NOTE = 18 / 0.75;
const NOTE_RADIUS = 15 / 0.75;
const NOTE_PAD = 15 / 0.75;
const NOTE_TO_SECTION = 24 / 0.75;
const SECTION_TO_CARDS = 12 / 0.75;
const CARD_GAP = 10 / 0.75;
/** The caption's two lines while the document's name loads, so nothing below it jumps. */
const CAPTION_SKELETON_BAR = 17 / 0.75;
const CAPTION_SKELETON_TAIL = 200 / 0.75;

/** Each component's drawing (580:616 … 580:708); two are the Profile row drawings. */
const RUBRIC_ART: Record<string, ListRowArt> = {
  keywords: { Icon: KeywordMatchIcon, w: 32, h: 22.5693 },
  timeline: PROFILE_ROW_ART.availability,
  sections: PROFILE_ROW_ART.terms,
  formatting: { Icon: FormattingIcon, w: 32, h: 20.4298 },
  achievements: { Icon: QuantifiedIcon, w: 32, h: 22.6632 },
};

/** The note's opening sentence is set bold on the board (580:609); the rest reads as body. */
function splitLead(note: string): [string, string] {
  const end = note.indexOf('. ');
  return end < 0 ? [note, ''] : [note.slice(0, end + 1), note.slice(end + 1)];
}

/**
 * The published rubric (V2 §7.8), drawn as RESUMES 10 (580:580): what the score is, what it is
 * not, and the five weighted components behind the number. §7.8 requires this page to be
 * reachable from every score display, so each "What this score measures" link lands here.
 */
export function ScoreRubricScreen({ id }: ScoreRubricScreenProps) {
  const { colors, motion, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();
  const actions = useResumesActions();

  const resume = useResume(id);

  // The board opens on Keyword match, the component that moves the score most (580:614).
  const [open, setOpen] = useState<readonly string[]>(SCORE_RUBRIC[0] ? [SCORE_RUBRIC[0].key] : []);
  const toggle = (key: string) =>
    setOpen((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));

  /**
   * The rubric is static content, so the resume query only ever names the document in the caption
   * below. Deliberately there is no page-level loading or error state and no `StateView`: a failed
   * or missing resume must not blank the one page that explains what the number means — the reader
   * may well have arrived here *because* something looked wrong. So every state the query can be
   * in lands on this one caption, and the rubric renders either way.
   */
  // `useResume` is disabled for an empty id, and a disabled query sits at `pending` for ever — so
  // the skeleton is gated on the id as well.
  const naming = id.length > 0 && resume.isPending;

  const caption = naming ? (
    <View style={[styles.captionSkeleton, { gap: spacing[1] }]}>
      <Skeleton height={s(CAPTION_SKELETON_BAR)} />
      <Skeleton width={s(CAPTION_SKELETON_TAIL)} height={s(CAPTION_SKELETON_BAR)} />
    </View>
  ) : (
    <Text variant="captionRegular" color="textSecondary" align="center" style={styles.caption}>
      {resume.data
        ? `Opened from "${resume.data.title}" — every document is scored the same way.`
        : 'Every document is scored the same way.'}
    </Text>
  );

  const [lead, rest] = splitLead(SCORE_HONESTY_NOTE);

  return (
    <Screen
      wash
      scroll
      edges={['top', 'bottom']}
      header={
        <ScreenHeader
          title={`How the ${SCORE_LABEL} works`}
          showTitle={false}
          onBack={actions.goBack}
        />
      }
      headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
    >
      <View style={styles.hero}>
        <AtsCheckArt width={s(HERO_ART_W)} height={s(HERO_ART_H)} />
        <Text {...a11yHeader()} variant="headlineLg" align="center" style={styles.title}>
          {`How the ${SCORE_LABEL} works`}
        </Text>
        {caption}
      </View>

      <View
        style={[
          styles.note,
          {
            borderWidth: sizes.border,
            borderColor: colors.brandBorder,
            backgroundColor: colors.brandSurface,
          },
        ]}
      >
        <Text variant="body" color="textBody">
          <Text variant="bodySemiBold" color="textPrimary">
            {lead}
          </Text>
          {rest}
        </Text>
      </View>

      <Text {...a11yHeader()} variant="title" style={styles.section}>
        What it measures
      </Text>

      <View style={styles.cards}>
        {SCORE_RUBRIC.map((component, index) => (
          <Animated.View
            key={component.key}
            entering={
              reduced
                ? undefined
                : FadeInDown.delay(
                    Math.min(index, motion.stagger.maxItems) * motion.stagger.row,
                  ).duration(motion.durations.base)
            }
          >
            <RubricCard
              component={component}
              art={RUBRIC_ART[component.key] ?? PROFILE_ROW_ART.terms}
              expanded={open.includes(component.key)}
              onToggle={() => toggle(component.key)}
            />
          </Animated.View>
        ))}
      </View>
    </Screen>
  );
}

const useStyles = scaledSheet((s) => ({
  hero: { alignItems: 'center' },
  title: { marginTop: s(ART_TO_TITLE) },
  caption: { marginTop: s(TITLE_TO_CAPTION) },
  captionSkeleton: { alignSelf: 'stretch', alignItems: 'center', marginTop: s(TITLE_TO_CAPTION) },
  note: { marginTop: s(HERO_TO_NOTE), borderRadius: s(NOTE_RADIUS), padding: s(NOTE_PAD) },
  section: { marginTop: s(NOTE_TO_SECTION) },
  cards: { marginTop: s(SECTION_TO_CARDS), gap: s(CARD_GAP) },
}));
