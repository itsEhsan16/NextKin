import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { compareProfileToJob } from '@/data/models';
import { keywordRowsOf } from '@/data/models/keywordRows';
import { useJdDraft, useJob, useJobJd, useProfile, useSubscription } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { useRevealStagger } from '@/ui/motion';

import { OnboardingFrame } from '../components/OnboardingFrame';
import { FlowCard, FlowDivider, FlowSection } from '../flow/FlowKit';
import { AtsEstimateCard, JobResumeRow, KeywordChooser, KeywordFooter } from '../flow/KeywordStep';
import { StepHelpSheet, stepName } from '../flow/ResumeSteps';
import { useCreateActions } from '../hooks/useCreateActions';
import { useBuildActions, useStartBuild } from '../hooks/useStartBuild';
import { BUILD_STEPS } from './BuildJobScreen';
import { addKeywordsCta } from './TailorCompareScreen';

export type BuildCompareScreenProps = {
  /** A saved job: read the way a build reads it. */
  jobId?: string;
  /** A job that was pasted or shared and already read; wins over `jobId`. */
  jdId?: string;
};

export const BUILD_MATCH_TITLE = 'Choose what to add';
export const BUILD_CTA = 'Build resume';
const LEDE =
  'Tick the skills from the job that you really have. They go on this resume and your profile.';

/**
 * Build Resume, "2 of 3 · Choose Keywords" (owner, 2026-11-18, toreview §235): the web's "Choose
 * what to add" (`BuildEnhanceStep`) in the same pieces as Tailor's keyword step — the job and the
 * profile, the match, Missing / Optional / All, and what the AI will write from the profile. The
 * profile comparison prices no keyword, so no row shows an impact and no estimate is made up.
 */
export function BuildCompareScreen({ jobId, jdId }: BuildCompareScreenProps) {
  const { u } = useTheme();
  const styles = useStyles();
  const actions = useBuildActions();
  const { openJobDetails } = useCreateActions();
  const build = useStartBuild();

  const read = useJdDraft(jdId ?? '');
  const forJob = useJobJd(jdId ? '' : (jobId ?? ''));
  const draft = jdId ? read : forJob;
  const job = useJob(jobId ?? '');
  const profile = useProfile();
  const subscription = useSubscription();

  const [added, setAdded] = useState<readonly string[]>([]);
  const [help, setHelp] = useState(false);
  const enter = useRevealStagger(!!draft.data && !!profile.data && !!subscription.data);
  const result = useMemo(
    () => (draft.data && profile.data ? compareProfileToJob(draft.data, profile.data) : null),
    [draft.data, profile.data],
  );
  const rows = useMemo(() => (result ? keywordRowsOf(result) : []), [result]);

  const frame = (body: React.ReactNode, footer?: React.ReactNode) => (
    <View style={styles.root}>
      <OnboardingFrame
        step={2}
        total={BUILD_STEPS}
        stepName={stepName(2)}
        title={BUILD_MATCH_TITLE}
        subtitle={LEDE}
        onBack={actions.goBack}
        onHelp={() => setHelp(true)}
        footer={footer}
      >
        {body}
      </OnboardingFrame>
      <StepHelpSheet step={2} open={help} onClose={() => setHelp(false)} />
    </View>
  );

  const failed = draft.isError || profile.isError || subscription.isError;
  if (failed || (jdId == null && jobId == null)) {
    return frame(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn’t compare"
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

  if (!draft.data || !profile.data || !subscription.data || !result) {
    return frame(
      <View
        style={styles.stack}
        accessible
        accessibilityLabel="Comparing your profile with this job"
      >
        <Skeleton height={u(84)} radius="cardLg" />
        <Skeleton height={u(140)} radius="cardLg" />
        <Skeleton height={u(220)} radius="cardLg" />
      </View>,
      <KeywordFooter ticked={0} total={0} label={BUILD_CTA} onPress={() => {}} disabled />,
    );
  }

  const jd = draft.data;
  const company = jd.company ?? job.data?.company ?? 'this company';
  const have = result.keywords.filter((keyword) => keyword.onResume).map((k) => k.label);
  const missing = result.keywords.filter((keyword) => !keyword.onResume).map((k) => k.label);
  const toFix = result.improvements.filter((item) => !item.ok);
  const linkedJobId = jd.jobId ?? jobId;
  const target = { jdId: jd.id, ...(linkedJobId ? { jobId: linkedJobId } : {}) };

  const onTick = (labels: readonly string[], on: boolean) =>
    setAdded((current) =>
      on
        ? [...current, ...labels.filter((l) => !current.includes(l))]
        : current.filter((l) => !labels.includes(l)),
    );

  const start = () =>
    build.start({
      ...target,
      build: {
        added: missing.filter((k) => added.includes(k)),
        skipped: missing.filter((k) => !added.includes(k)),
      },
    });

  const footer = build.quotaSpent ? (
    <KeywordFooter
      ticked={added.length}
      total={result.keywords.length}
      label="See Pro plans"
      note={build.quotaNote || undefined}
      onPress={() => actions.openUpgrade('generations')}
    />
  ) : (
    <KeywordFooter
      ticked={added.length}
      total={result.keywords.length}
      label={added.length > 0 ? addKeywordsCta(added.length) : BUILD_CTA}
      note={build.error ?? (build.quotaNote || undefined)}
      noteTone={build.error ? 'danger' : 'neutral'}
      loading={build.pending}
      onPress={start}
    />
  );

  return frame(
    <View style={styles.stack}>
      <Animated.View entering={enter(0)}>
        <JobResumeRow
          job={`${jd.title} · ${company}`}
          resumeTitle="your profile"
          onPress={() => openJobDetails(jd.id)}
          label="View the job"
        />
      </Animated.View>
      <Animated.View entering={enter(1)}>
        <AtsEstimateCard
          score={result.score}
          scored
          gain={0}
          ticked={added.length}
          emptyLine={
            added.length > 0
              ? 'Added skills go on your profile too.'
              : missing.length > 0
                ? 'Tick the skills you have. They go on your resume.'
                : 'Your profile has every one.'
          }
        />
      </Animated.View>
      {result.keywords.length > 0 ? (
        <Animated.View entering={enter(2)}>
          <KeywordChooser
            rows={rows}
            have={have}
            ticked={added}
            onTick={onTick}
            haveLabel="On your profile"
          />
        </Animated.View>
      ) : null}
      {toFix.length > 0 ? (
        <Animated.View entering={enter(3)}>
          <FlowSection
            icon="AiMagic"
            title="What the AI will write"
            body="From your profile, aimed at this job."
          >
            <FlowCard style={styles.fixCard}>
              {toFix.map((item, index) => (
                <View key={item.key}>
                  {index > 0 ? <FlowDivider /> : null}
                  <View style={styles.fixRow}>
                    <Text variant="bodyLgStrong" color="ink">
                      {item.label}
                    </Text>
                    <Text variant="callout" color="textSecondary">
                      {item.detail}
                    </Text>
                  </View>
                </View>
              ))}
            </FlowCard>
          </FlowSection>
        </Animated.View>
      ) : null}
    </View>,
    footer,
  );
}

const useStyles = scaledSheet((_s, u) => ({
  root: { flex: 1 },
  stack: { gap: u(20), paddingBottom: u(8) },
  fixCard: { paddingVertical: u(4) },
  fixRow: { gap: u(2), paddingVertical: u(12) },
}));
