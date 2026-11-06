import type { ReactNode } from 'react';
import { View } from 'react-native';

import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';
import { matchBandFor, matchBasisCaption } from '@/data/models';
import { useJob } from '@/data/queries';
import { formatJobMeta } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { ScoreRing } from '@/ui/Progress';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { CriteriaGroups } from '../components/CriteriaGroups';
import { CriteriaSkeleton } from '../components/CriteriaSkeleton';
import { MatchBadge } from '../components/JobPills';
import { useJobsActions } from '../hooks/useJobsActions';
import {
  groupMatchCriteria,
  matchPercentage,
  MATCH_HONESTY_NOTE,
  MATCH_RING_COLOR,
  MATCH_RING_LABEL,
  TAILOR_TO_JOB_CTA,
} from '../matchCriteria';
import { Icon } from '@/ui/Icon';

export type MatchCriteriaScreenProps = { jobId: string };

// JOBS 10 at 390 (580:2428), in artboard units.
const HEADER_TO_HERO = 18 / 0.75;
const RING = 112 / 0.75;
const RING_STROKE = 8.4 / 0.75;
const RING_TO_PILL = 12 / 0.75;
const PILL_TO_CAPTION = 10 / 0.75;
const HERO_TO_NOTE = 20 / 0.75;
const NOTE_RADIUS = 15 / 0.75;
const NOTE_PAD = 14 / 0.75;
const NOTE_GAP = 10 / 0.75;
const NOTE_SLOT_W = 18 / 0.75;
const NOTE_SLOT_H = 19 / 0.75;
const NOTE_TO_CARDS = 14 / 0.75;
/** The bar's sparkle (580:2502) — the same drawing as the AI sparkle trio. */
const SPARKLE_W = 18 / 0.75;
const SPARKLE_H = 17.6315 / 0.75;

/**
 * JOBS 10 — the full match breakdown (V2 §7.13, Figma 580:2428), pushed from "See full criteria"
 * on the job detail's "Why you match" card.
 *
 * §7.13 requires the honesty note on this page, so it is a constant in `matchCriteria.ts` and
 * sits above the criteria rather than under them — the reader must meet the caveat before the
 * list that looks like a verdict, not after it.
 */
export function MatchCriteriaScreen({ jobId }: MatchCriteriaScreenProps) {
  const { colors, sizes, spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useJobsActions();

  const job = useJob(jobId);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      wash
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Why you match" onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
      contentContainerStyle={{ paddingBottom: spacing[8] }}
      footer={footer}
    >
      {children}
    </Screen>
  );

  // `useJob` is disabled for an empty id, and a disabled query sits at `pending` for ever — so
  // the skeleton is gated on the id as well, or a route opened without one would pulse here
  // indefinitely instead of falling through to the error state below.
  if (jobId.length > 0 && job.isPending) {
    return page(
      <CriteriaSkeleton />,
      <StickyActionBar floating primary={{ label: TAILOR_TO_JOB_CTA, disabled: true }} />,
    );
  }

  if (job.isError || !job.data) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load this match"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void job.refetch()}
      />,
    );
  }

  const current = job.data;
  const groups = groupMatchCriteria(current.matchCriteria ?? []);
  // A listing read from a snippet or a title has a band and a basis but no number (P11-03):
  // the ring is drawn only when there is a number to draw, never at a stand-in 0%.
  const percent = current.matchScore != null ? matchPercentage(current.matchScore) : null;
  const band = current.matchBand ?? matchBandFor(current.matchScore ?? 0);

  /**
   * No criteria means no match was computed — usually because the profile has too little on it
   * to compare against, which is what the reader can actually fix. Deliberately no tailoring bar
   * here: the page has one recovery, and a pinned primary would out-rank the state's own action
   * while doing nothing about the reason this page is empty. Tailoring is still one press away
   * on the job detail this was opened from.
   */
  if (groups.length === 0) {
    return page(
      <StateView
        icon="UserEdit"
        title="We can't score this match yet"
        message="Matching reads the skills and experience on your profile."
        actionLabel="Complete your profile"
        onAction={actions.openProfileSkills}
      />,
    );
  }

  return page(
    <>
      <View style={styles.hero}>
        {percent !== null ? (
          <ScoreRing
            score={percent}
            label={MATCH_RING_LABEL}
            size={s(RING)}
            strokeWidth={s(RING_STROKE)}
            ringColor={MATCH_RING_COLOR[band]}
            trackColor="progressTrack"
            numberVariant="scoreHero"
            numberColor="textPrimary"
            labelVariant="scoreRingLabel"
            labelColor="textSecondary"
            accessibilityLabel={`Match ${percent}%`}
          />
        ) : null}
        <View style={styles.pill}>
          <MatchBadge band={band} />
        </View>
        <Text variant="micro" color="textSecondary" align="center" style={styles.caption}>
          {formatJobMeta([current.title, current.company])}
        </Text>
        {current.matchBasis ? (
          <Text variant="microRegular" color="textSecondary" align="center">
            {matchBasisCaption(current.matchBasis)}
          </Text>
        ) : null}
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
        <View style={styles.noteSlot}>
          <Icon name="InfoCircle" size="sm" color={colors.brand} />
        </View>
        <Text variant="captionRegular" color="textBody" style={styles.noteText}>
          {MATCH_HONESTY_NOTE}
        </Text>
      </View>

      <View style={styles.cards}>
        <CriteriaGroups groups={groups} />
      </View>
    </>,
    <StickyActionBar
      floating
      primary={{
        label: TAILOR_TO_JOB_CTA,
        leading: <SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />,
        onPress: () => actions.tailorResume(current),
      }}
    />,
  );
}

const useStyles = scaledSheet((s) => ({
  hero: { alignItems: 'center' },
  pill: { marginTop: s(RING_TO_PILL) },
  caption: { marginTop: s(PILL_TO_CAPTION) },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: s(HERO_TO_NOTE),
    borderRadius: s(NOTE_RADIUS),
    padding: s(NOTE_PAD),
    gap: s(NOTE_GAP),
  },
  noteSlot: {
    width: s(NOTE_SLOT_W),
    height: s(NOTE_SLOT_H),
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteText: { flex: 1 },
  cards: { marginTop: s(NOTE_TO_CARDS) },
}));
