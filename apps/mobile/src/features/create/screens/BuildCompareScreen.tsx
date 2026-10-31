import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { compareProfileToJob, type TailorKeyword } from '@/data/models';
import {
  useCurrentUser,
  useJdDraft,
  useJob,
  useJobJd,
  useProfile,
  useSubscription,
} from '@/data/queries';
import SparkleIcon from '../../../../assets/icons/ai-sparkle-trio.svg';

import { scaledSheet, useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useRevealStagger } from '@/ui/motion';

import { AddKeywordsSheet, collectChoices, defaultChoice } from '../components/AddKeywordsSheet';
import type { TailorChoice } from '../components/AddSkipToggle';
import { draftMetaLine } from '../components/BuildReviewCard';
import { BuildVsCard } from '../components/BuildVsCard';
import { TailorCompareSkeleton } from '../components/TailorCompareSkeleton';
import { TailorHero } from '../components/TailorHero';
import { TailorImproveCard } from '../components/TailorImproveCard';
import { TailorKeywords } from '../components/TailorKeywords';
import { jobMetaLine } from '../components/TailorVsCard';
import { useBuildActions, useStartBuild } from '../hooks/useStartBuild';

export type BuildCompareScreenProps = {
  /** A saved job (BUILD 01/02): read the way a build reads it. */
  jobId?: string;
  /** A job read on BUILD 03/04; wins over `jobId` when both are set. */
  jdId?: string;
};

const TITLE = 'Your profile vs this job';
const CTA = 'Fix and build my resume';
/** V2 §7.8: nothing new goes on the resume without the user's yes in BUILD 04c. */
const BAR_NOTE = 'We’ll ask before adding anything new.';

// BUILD 04b at 390 (663:2), in artboard units.
const HEADER_TO_HERO = 22 / 0.75; // 663:24
const HERO_TO_CARD = 20 / 0.75; // 663:34
const SECTION_GAP = 24 / 0.75; // 663:62 / 663:95
const SPARKLE_W = 18 / 0.75; // 663:135
const SPARKLE_H = 17.6315 / 0.75;

/**
 * BUILD 04b (663:2) — the profile against the job before anything is built (toreview §74): how
 * much of the job the profile covers as the JOB MATCH ring, the job beside the profile, the job's
 * keywords on and off the profile, and what the build will improve. "Fix and build my resume"
 * asks about each missing keyword first (BUILD 04c) and goes straight to the run when nothing is
 * missing — TAILOR 02's shape, with the profile in the resume's place.
 */
export function BuildCompareScreen({ jobId, jdId }: BuildCompareScreenProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useBuildActions();
  const build = useStartBuild();

  const read = useJdDraft(jdId ?? '');
  const forJob = useJobJd(jdId ? '' : (jobId ?? ''));
  const draft = jdId ? read : forJob;
  const job = useJob(jobId ?? '');
  const profile = useProfile();
  const user = useCurrentUser();
  const subscription = useSubscription();

  const [askOpen, setAskOpen] = useState(false);
  const [choices, setChoices] = useState<Record<string, TailorChoice>>({});
  const choiceFor = (keyword: TailorKeyword) => choices[keyword.label] ?? defaultChoice(keyword);

  // Sections fade up in turn only when loaded data replaces the skeleton; a screen that opens
  // with its data already here slides in whole with the push.
  const enter = useRevealStagger(!!draft.data && !!profile.data && !!subscription.data);

  const page = (children: ReactNode, footer?: ReactNode, sheet?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title={TITLE} showTitle={false} onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: s(HEADER_TO_HERO) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        footer={footer}
      >
        {children}
      </Screen>
      {/* A sibling of the page, never a child of its scroller. */}
      {sheet}
    </View>
  );

  const failed = draft.isError || profile.isError || subscription.isError;
  if (failed || (jdId == null && jobId == null)) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't compare your profile"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => {
          if (draft.isError) void draft.refetch();
          if (profile.isError) void profile.refetch();
          if (subscription.isError) void subscription.refetch();
        }}
      />,
    );
  }

  if (!draft.data || !profile.data || !subscription.data) {
    return page(
      <TailorCompareSkeleton label="Comparing your profile with this job" />,
      <StickyActionBar floating primary={{ label: CTA, disabled: true }} />,
    );
  }

  const jd = draft.data;
  const result = compareProfileToJob(jd, profile.data);
  const company = jd.company ?? job.data?.company ?? 'this company';
  const missing = result.keywords.filter((keyword) => !keyword.onResume);
  const { generationsUsed: used, generationsLimit: limit } = subscription.data.usage;
  const linkedJobId = jd.jobId ?? jobId;
  const target = { jdId: jd.id, ...(linkedJobId ? { jobId: linkedJobId } : {}) };
  // With nothing to ask, Fix IS the run, so the bar carries the cost the sheet would have shown.
  const direct = missing.length === 0;

  const bar = (
    <StickyActionBar
      floating
      note={direct ? (build.error ?? (build.quotaNote || BAR_NOTE)) : BAR_NOTE}
      noteTone={direct && build.error ? 'danger' : 'neutral'}
      primary={
        direct && build.quotaSpent
          ? { label: 'See Pro plans', onPress: () => actions.openUpgrade('generations') }
          : {
              label: CTA,
              leading: <SparkleIcon width={s(SPARKLE_W)} height={s(SPARKLE_H)} />,
              loading: direct && build.pending,
              onPress: () =>
                direct
                  ? build.start({ ...target, build: { added: [], skipped: [] } })
                  : setAskOpen(true),
            }
      }
    />
  );

  return page(
    <>
      <Animated.View entering={enter(0)}>
        <TailorHero variant="build" score={result.score} company={company} />
      </Animated.View>
      <Animated.View entering={enter(1)} style={{ marginTop: s(HERO_TO_CARD) }}>
        <BuildVsCard
          job={{
            title: jd.title,
            company,
            meta: job.data ? jobMetaLine(job.data) : draftMetaLine(jd),
          }}
          profile={{
            name: user.data?.firstName ?? '',
            avatarUrl: user.data?.avatarUrl,
            roles: profile.data.experiences.length,
            skills: profile.data.skills.length,
          }}
          onEdit={actions.openProfileEditor}
        />
      </Animated.View>
      {result.keywords.length > 0 ? (
        <Animated.View entering={enter(2)} style={{ marginTop: s(SECTION_GAP) }}>
          <TailorKeywords keywords={result.keywords} subject="profile" />
        </Animated.View>
      ) : null}
      <Animated.View entering={enter(3)} style={{ marginTop: s(SECTION_GAP) }}>
        <TailorImproveCard improvements={result.improvements} />
      </Animated.View>
    </>,
    bar,
    <AddKeywordsSheet
      variant="build"
      open={askOpen}
      company={company}
      keywords={missing}
      choiceFor={choiceFor}
      onChoose={(keyword, choice) => setChoices((prev) => ({ ...prev, [keyword.label]: choice }))}
      used={used}
      limit={limit}
      busy={build.pending}
      failure={build.error}
      onCreate={() => build.start({ ...target, build: collectChoices(missing, choiceFor) })}
      onUpgrade={() => {
        setAskOpen(false);
        actions.openUpgrade('generations');
      }}
      onClose={() => setAskOpen(false)}
    />,
  );
}

const useStyles = scaledSheet(() => ({
  root: { flex: 1 },
}));
