import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  nothingChosen,
  projectedScore,
  tailorRunInput,
  runProblem,
  startErrorLine,
} from '@/data/models/customize';
import {
  queryPhase,
  isConsentRequired,
  useKeywordQuestions,
  useStartGeneration,
} from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { useRevealStagger } from '@/ui/motion';

import { NoResumeCard } from '../components/NoResumeCard';
import { OnboardingFrame } from '../components/OnboardingFrame';
import { TailorResumeSheet } from '../components/TailorResumeSheet';
import { customizeKey, useCustomizeChoices } from '../customizeStore';
import { FlowCard, FlowRow, FlowSection } from '../flow/FlowKit';
import { KeywordAsks } from '../flow/KeywordAsks';
import {
  AtsEstimateCard,
  JobResumeRow,
  KeywordChooser,
  KeywordFooter,
  tailorTicks,
} from '../flow/KeywordStep';
import { RESUME_STEP_COUNT, StepHelpSheet, stepName } from '../flow/ResumeSteps';
import { AiPlanCard, MoreOptionsSheet } from '../flow/ReviewParts';
import { generationsLeftNote, spentNote } from '../generationQuota';
import { useCreateActions, type CustomizeTarget } from '../hooks/useCreateActions';
import { useCustomizeData } from '../hooks/useCustomizeData';

export type TailorCompareScreenProps = CustomizeTarget;

/** The button with nothing ticked: the AI's own changes still run. */
export const CUSTOMIZE_CTA = 'Continue';
export const addKeywordsCta = (n: number) => `Add ${n} keyword${n === 1 ? '' : 's'}`;
export const REVIEW_TITLE = 'Choose keywords to add';
const LEDE =
  'Tick the keywords from the job that you really have. We’ll add them naturally to lift your ATS score.';
/** The web's promise line (`NEVER_ADDS_SKILLS`). */
const NEVER_ADDS =
  'We add only what you accept. You decide what goes on your resume, and interviewers may ask about any of it.';
const START_FAILED = 'We couldn’t start it. Check your connection and try again.';
const NOTHING_CHOSEN = 'Tick a keyword, or turn on something the AI will change.';

/**
 * Tailor, "2 of 3 · Choose Keywords" (owner, 2026-11-18, toreview §234): the web's "Choose
 * keywords to add" step in the app's kit. The job and resume, the ATS card with what the ticked
 * keywords add, Missing / Optional / All with each keyword's impact, where it all lands, then the
 * "Did you use these?" questions and what the AI will change. Nothing is pre-ticked (D-25).
 */
export function TailorCompareScreen(props: TailorCompareScreenProps) {
  const styles = useStyles();
  const { u } = useTheme();
  const actions = useCreateActions();
  const data = useCustomizeData(props);
  const start = useStartGeneration();
  const [choices, update] = useCustomizeChoices(customizeKey(props, data.resumeId));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const set = (next: typeof choices) => update(() => next);

  const { target, comparison, resume, subscription, resumes } = data;
  // "Did you use these?" (toreview §206.3): asked once the comparison is there, never in its way.
  const asked =
    useKeywordQuestions(comparison.data?.resumeId ?? '', comparison.data?.jdId ?? '').data ?? [];
  const enter = useRevealStagger(
    !!target && !!resume.data && !!comparison.data && !!subscription.data,
  );
  const subtitle = target
    ? `${target.title}${target.company ? ` · ${target.company}` : ''}`
    : undefined;

  const page = (children: ReactNode, footer?: ReactNode, title = REVIEW_TITLE) => (
    <View style={styles.root}>
      <OnboardingFrame
        step={2}
        total={RESUME_STEP_COUNT}
        stepName={stepName(2)}
        title={title}
        subtitle={title === REVIEW_TITLE ? LEDE : subtitle}
        onBack={actions.goBack}
        onHelp={() => setHelpOpen(true)}
        footer={footer}
      >
        {children}
      </OnboardingFrame>
      {/* Sheets are siblings of the page, never children of its scroller. */}
      <TailorResumeSheet
        open={pickerOpen}
        job={target ?? { title: 'this job' }}
        selectedResumeId={data.resumeId || undefined}
        onClose={() => setPickerOpen(false)}
        onCompare={(id) => {
          setPickerOpen(false);
          if (id !== data.resumeId) actions.compareResume(id);
        }}
      />
      <StepHelpSheet step={2} open={helpOpen} onClose={() => setHelpOpen(false)} />
      <MoreOptionsSheet
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        choices={choices}
        onChange={set}
      />
    </View>
  );

  const retry = (title: string, onAction: () => void) =>
    page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title={title}
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={onAction}
      />,
    );

  if (data.targetMissing) {
    return page(
      <StateView
        icon="Briefcase01"
        title="This job isn’t available"
        message="It may have closed or been removed."
        actionLabel="Back"
        onAction={actions.goBack}
      />,
    );
  }
  if (data.targetQuery.isError) {
    return retry('Couldn’t load this job', () => void data.targetQuery.refetch());
  }
  if (queryPhase(resumes) === 'error' || queryPhase(subscription) === 'error') {
    return retry('Couldn’t load your resumes', () => {
      if (queryPhase(resumes) === 'error') void resumes.refetch();
      if (queryPhase(subscription) === 'error') void subscription.refetch();
    });
  }

  const loading = (
    <View style={styles.stack} accessible accessibilityLabel="Comparing your resume with this job">
      <Skeleton height={u(84)} radius="cardLg" />
      <Skeleton height={u(140)} radius="cardLg" />
      <Skeleton height={u(260)} radius="cardLg" />
    </View>
  );
  const inertFooter = <KeywordFooter label={CUSTOMIZE_CTA} onPress={() => {}} disabled />;
  if (!target || !resumes.data || !subscription.data) return page(loading, inertFooter);

  if (data.noResume) {
    const roles = data.profile.data?.experiences.length ?? 0;
    const where = { jobId: props.jobId, jdId: props.jdId };
    return page(
      <NoResumeCard
        onUpload={() => setPickerOpen(true)}
        onBuild={roles > 0 ? () => actions.openBuildCompare(where) : undefined}
        onStartFromNothing={
          roles > 0
            ? undefined
            : () => actions.openZeroResume({ jobId: props.jobId, role: target.title })
        }
      />,
      undefined,
      'First, a resume',
    );
  }

  if (queryPhase(resume) === 'error' || queryPhase(comparison) === 'error') {
    return retry('Couldn’t compare your resume', () => {
      if (queryPhase(resume) === 'error') void resume.refetch();
      if (queryPhase(comparison) === 'error') void comparison.refetch();
    });
  }
  if (!resume.data || !comparison.data) return page(loading, inertFooter);

  const result = comparison.data;
  const { generationsUsed: used, generationsLimit: limit } = subscription.data.usage;
  const spent = used >= limit;
  const empty = nothingChosen(choices);
  const failed = start.isError && !isConsentRequired(start.error);
  const projected = projectedScore(result.plan, choices) ?? result.plan?.target?.ai;
  // What the candidate's own answers add on top of the AI's steps: the card's estimate (web §166).
  const withoutAnswers = projectedScore(result.plan, {
    ...choices,
    added: [],
    places: {},
    figures: {},
  });
  const answersGain =
    projected !== undefined && withoutAnswers !== undefined
      ? Math.round((projected - withoutAnswers) * 10) / 10
      : 0;
  const ticked = choices.added.length;
  const optionsLine = [
    choices.experience === 'quick' ? 'Latest 2 roles' : 'Every role',
    choices.fixes.includes('length') ? 'trimmed' : 'full length',
  ].join(' · ');

  // Never send a run the server will refuse: say what is in the way instead (toreview §212.5).
  const problem = runProblem(choices);
  const create = () => {
    if (problem) return;
    start.mutate(tailorRunInput(result, choices, props.jobId), {
      onSuccess: (generation) => actions.openGeneration(generation.id),
    });
  };

  const note = problem
    ? problem
    : failed
      ? startErrorLine(start.error, START_FAILED)
      : spent
        ? spentNote(limit)
        : empty
          ? NOTHING_CHOSEN
          : generationsLeftNote(used, limit);

  return page(
    <View style={styles.stack}>
      <Animated.View entering={enter(0)}>
        <JobResumeRow
          job={subtitle ?? target.title}
          resumeTitle={resume.data.title}
          onPress={() => setPickerOpen(true)}
        />
      </Animated.View>
      <Animated.View entering={enter(1)}>
        <AtsEstimateCard
          score={result.score}
          scored={result.scored !== false}
          gain={answersGain}
          ticked={ticked}
        />
      </Animated.View>
      {result.keywords.length > 0 ? (
        <Animated.View entering={enter(2)} style={styles.section}>
          <KeywordChooser {...tailorTicks(result, choices, set)} />
        </Animated.View>
      ) : null}
      {asked.length > 0 ? (
        <Animated.View entering={enter(3)}>
          <KeywordAsks questions={asked} choices={choices} onChange={set} />
        </Animated.View>
      ) : null}
      <Animated.View entering={enter(3)}>
        <FlowSection
          icon="AiMagic"
          title="What the AI will change"
          body="Picked for this job. Tap anything to change it."
        >
          <View style={styles.section}>
            <AiPlanCard
              company={data.company}
              resumeId={result.resumeId}
              steps={result.plan?.steps ?? []}
              choices={choices}
              onChange={set}
            />
            <FlowCard style={styles.optionsCard}>
              <FlowRow
                icon="Sliders01"
                title="More options"
                body={optionsLine}
                onPress={() => setOptionsOpen(true)}
              />
            </FlowCard>
          </View>
        </FlowSection>
      </Animated.View>
      <Text variant="footnote" color="textTertiary" align="center">
        {NEVER_ADDS}
      </Text>
    </View>,
    spent ? (
      <KeywordFooter
        label="See Pro plans"
        note={note}
        onPress={() => actions.openUpgrade('generations')}
      />
    ) : (
      <KeywordFooter
        label={ticked > 0 ? addKeywordsCta(ticked) : CUSTOMIZE_CTA}
        note={note}
        noteTone={failed || problem ? 'danger' : 'neutral'}
        loading={start.isPending}
        disabled={empty}
        onPress={create}
      />
    ),
  );
}

const useStyles = scaledSheet((_s, u) => ({
  root: { flex: 1 },
  stack: { gap: u(20), paddingBottom: u(8) },
  section: { gap: u(14) },
  optionsCard: { paddingVertical: u(2) },
}));
