import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { nothingChosen, projectedScore, tailorRunInput } from '@/data/models/customize';
import { isConsentRequired, useStartGeneration } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { useRevealStagger } from '@/ui/motion';

import { NoResumeCard } from '../components/NoResumeCard';
import { OnboardingFrame } from '../components/OnboardingFrame';
import { TailorResumeSheet } from '../components/TailorResumeSheet';
import { customizeKey, useCustomizeChoices } from '../customizeStore';
import { FlowCard, FlowFooter, FlowRow, FlowSection } from '../flow/FlowKit';
import { AiPlanCard, MoreOptionsSheet, ReviewHero, SkillChips } from '../flow/ReviewParts';
import { generationsLeftNote, spentNote } from '../generationQuota';
import { useCreateActions, type CustomizeTarget } from '../hooks/useCreateActions';
import { useCustomizeData } from '../hooks/useCustomizeData';

export type TailorCompareScreenProps = CustomizeTarget;

export const CUSTOMIZE_CTA = 'Create my resume';
export const REVIEW_TITLE = 'Ready to tailor';
const START_FAILED = 'We couldn’t start it. Check your connection and try again.';
const NOTHING_CHOSEN = 'Turn on something in the plan, or tap a skill.';

/**
 * Build Resume, step 2 of 3 — Review (toreview §173, Figma "Build · 2 Review"). Replaces the old
 * Compare/Fix/Download screen. Nothing has to be answered: the AI's plan is already picked, and
 * one tap creates. The score card says where the plan takes it; the plan rows turn off with a tap;
 * a step that needs a real number shows the AI's guess to accept or edit; missing skills are
 * one-tap chips; the rare settings sit in "More options".
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
  const set = (next: typeof choices) => update(() => next);

  const { target, comparison, resume, subscription, resumes } = data;
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
        total={3}
        title={title}
        subtitle={subtitle}
        onBack={actions.goBack}
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
  if (resumes.isError || subscription.isError) {
    return retry('Couldn’t load your resumes', () => {
      if (resumes.isError) void resumes.refetch();
      if (subscription.isError) void subscription.refetch();
    });
  }

  const loading = (
    <View style={styles.stack} accessible accessibilityLabel="Comparing your resume with this job">
      <Skeleton height={u(170)} radius="cardLg" />
      <Skeleton height={u(220)} radius="cardLg" />
    </View>
  );
  const inertFooter = (
    <FlowFooter primary={{ label: CUSTOMIZE_CTA, onPress: () => {}, disabled: true }} />
  );
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

  if (resume.isError || comparison.isError) {
    return retry('Couldn’t compare your resume', () => {
      if (resume.isError) void resume.refetch();
      if (comparison.isError) void comparison.refetch();
    });
  }
  if (!resume.data || !comparison.data) return page(loading, inertFooter);

  const result = comparison.data;
  const { generationsUsed: used, generationsLimit: limit } = subscription.data.usage;
  const spent = used >= limit;
  const empty = nothingChosen(choices);
  const failed = start.isError && !isConsentRequired(start.error);
  const jdId = data.jdId;
  const projected = projectedScore(result.plan, choices) ?? result.plan?.target?.ai;
  const optionsLine = [
    choices.experience === 'quick' ? 'Latest 2 roles' : 'Every role',
    choices.fixes.includes('length') ? 'trimmed' : 'full length',
  ].join(' · ');

  const create = () =>
    start.mutate(tailorRunInput(result, choices, props.jobId), {
      onSuccess: (generation) => actions.openGeneration(generation.id),
    });

  const note = failed
    ? START_FAILED
    : spent
      ? spentNote(limit)
      : empty
        ? NOTHING_CHOSEN
        : generationsLeftNote(used, limit);

  return page(
    <View style={styles.stack}>
      <Animated.View entering={enter(0)}>
        <ReviewHero
          score={result.score}
          scored={result.scored !== false}
          projected={projected}
          sourceTitle={resume.data.title}
          onChangeSource={() => setPickerOpen(true)}
          onViewJob={jdId ? () => actions.openJobDetails(jdId) : undefined}
        />
      </Animated.View>
      <Animated.View entering={enter(1)}>
        <FlowSection
          icon="AiMagic"
          title="AI’s plan"
          body="Picked for this job. Tap anything to change it."
        >
          <AiPlanCard
            company={data.company}
            resumeId={result.resumeId}
            steps={result.plan?.steps ?? []}
            choices={choices}
            onChange={set}
          />
        </FlowSection>
      </Animated.View>
      {result.keywords.length > 0 ? (
        <Animated.View entering={enter(2)}>
          <FlowSection title="Skills it asks for" body="Tap the missing ones you really have.">
            <SkillChips comparison={result} choices={choices} onChange={set} />
          </FlowSection>
        </Animated.View>
      ) : null}
      <Animated.View entering={enter(3)}>
        <FlowCard style={styles.optionsCard}>
          <FlowRow
            icon="Sliders01"
            title="More options"
            body={optionsLine}
            onPress={() => setOptionsOpen(true)}
          />
        </FlowCard>
      </Animated.View>
    </View>,
    <FlowFooter
      note={note}
      noteTone={failed ? 'danger' : 'neutral'}
      primary={
        spent
          ? { label: 'See Pro plans', onPress: () => actions.openUpgrade('generations') }
          : {
              label: CUSTOMIZE_CTA,
              icon: 'Stars02',
              loading: start.isPending,
              disabled: empty,
              onPress: create,
            }
      }
    />,
  );
}

const useStyles = scaledSheet((_s, u) => ({
  root: { flex: 1 },
  stack: { gap: u(24), paddingBottom: u(8) },
  optionsCard: { paddingVertical: u(2) },
}));
