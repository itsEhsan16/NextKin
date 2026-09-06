import type { ReactNode } from 'react';
import { View } from 'react-native';

import { matchBandFor } from '@/data/models';
import { useJob } from '@/data/queries';
import { useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { ScoreRing } from '@/ui/Progress';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { CriteriaGroups } from '../components/CriteriaGroups';
import { CriteriaSkeleton } from '../components/CriteriaSkeleton';
import { MatchPill } from '../components/JobPills';
import { useJobsActions } from '../hooks/useJobsActions';
import {
  groupMatchCriteria,
  matchPercentage,
  MATCH_HONESTY_NOTE,
  MATCH_RING_COLOR,
  MATCH_RING_LABEL,
  TAILOR_TO_JOB_CTA,
} from '../matchCriteria';

export type MatchCriteriaScreenProps = { jobId: string };

/** The score panel's ring, at the same size — this page is the match's equivalent of it. */
const RING = 132;
const RING_STROKE = 10;

/**
 * JOBS — the full match breakdown (V2 §7.13), pushed from "See full criteria" on the job
 * detail's "Why you match" card. No artboard covers this flow (plan §8, phase 9), so it is
 * assembled from built primitives only.
 *
 * §7.13 requires the honesty note on this page, so it is a constant in `matchCriteria.ts` and
 * sits above the criteria rather than under them — the reader must meet the caveat before the
 * list that looks like a verdict, not after it.
 */
export function MatchCriteriaScreen({ jobId }: MatchCriteriaScreenProps) {
  const { spacing, s } = useTheme();
  const actions = useJobsActions();

  const job = useJob(jobId);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={<ScreenHeader title="Why you match" onBack={actions.goBack} />}
      headerStyle={{ paddingBottom: spacing[4] }}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
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
      <StickyActionBar primary={{ label: TAILOR_TO_JOB_CTA, disabled: true }} />,
    );
  }

  if (job.isError || !job.data) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
        title="Couldn't load this match"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void job.refetch()}
      />,
    );
  }

  const current = job.data;
  const groups = groupMatchCriteria(current.matchCriteria ?? []);
  const percent = matchPercentage(current.matchScore ?? 0);
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
        icon="user-edit"
        title="We can't score this match yet"
        message="Matching reads the skills and experience on your profile. Add a few and we'll score this job against them."
        actionLabel="Complete your profile"
        onAction={actions.openProfileSkills}
      />,
    );
  }

  return page(
    <>
      <View style={{ alignItems: 'center', gap: spacing[3] }}>
        <ScoreRing
          score={percent}
          label={MATCH_RING_LABEL}
          size={s(RING)}
          strokeWidth={s(RING_STROKE)}
          ringColor={MATCH_RING_COLOR[band]}
          trackColor="surfaceSubtle"
          numberVariant="scoreHero"
          numberColor="textPrimary"
          labelVariant="microOverline"
          labelColor="textSecondary"
          accessibilityLabel={`Match ${percent}%`}
        />
        <MatchPill band={band} />
      </View>

      <Card>
        <Text variant="body" color="textBody">
          {MATCH_HONESTY_NOTE}
        </Text>
      </Card>

      <CriteriaGroups groups={groups} />
    </>,
    <StickyActionBar
      primary={{
        label: TAILOR_TO_JOB_CTA,
        icon: 'magic',
        onPress: () => actions.tailorResume(current),
      }}
    />,
  );
}
