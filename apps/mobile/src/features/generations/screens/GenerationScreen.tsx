import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import { GENERATION_KIND_LABEL, type Generation, type GenerationKind } from '@/data/models';
import {
  useGeneration,
  useInterviewSetForGeneration,
  useResume,
  useRetryGeneration,
} from '@/data/queries';
import { COVER_STEPS, FlowStepper, ZERO_STEPS } from '@/features/create/components/TailorStepper';
// Deep import on purpose: the notifications barrel drags its screens in. This is plain.
import { offerPushForRun } from '@/features/notifications/components/PushPrimerSheet';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';
import { Reveal } from '@/ui/motion';

import { BuildRunView } from '../components/BuildRunView';
import { AtsRunView } from '../components/AtsRunView';
import { CoverRunView } from '../components/CoverRunView';
import { ZeroRunView } from '../components/ZeroRunView';
import { GenerationHero } from '../components/GenerationHero';
import { GenerationSteps } from '../components/GenerationSteps';
import { TailorChrome } from '../components/TailorChrome';
import { TailorRunView } from '../components/TailorRunView';
import { useGenerationsActions } from '../hooks/useGenerationsActions';

export type GenerationScreenProps = { id: string };

/** Kinds whose output is a scored document, so the ready hero can show a ring. */
const RING_KINDS: readonly GenerationKind[] = ['resume', 'zero_resume'];
/** Kinds whose result screen is the ATS panel — §7.8's check included, which *is* a score. */
const SCORE_KINDS: readonly GenerationKind[] = ['resume', 'zero_resume', 'ats_check'];

const LEAVE_NOTE = "You can leave this screen — we'll keep going and tell you when it's ready.";

/**
 * The repo's not-found error, recognised by shape. Screens may not import `@/data/repos`, and
 * "this id no longer resolves" is a different answer from "we could not reach the server" —
 * one sends the user to the library, the other offers a retry.
 */
function isMissing(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { code?: unknown }).code === 'NOT_FOUND';
}

const documentLabel = (kind: GenerationKind): string =>
  kind === 'cover_letter' ? 'Open cover letter' : 'Open resume';

/** An interview run finishes on its practice set, which does not exist until it is ready. */
const INTERVIEW_CTA = 'Start practising';

/**
 * GENERATION — one run, watched (V2 §7.6). The spec is emphatic that every state transition is
 * visible and that a failure shows a reason and a working retry, "never a silent hang", so this
 * screen shows the pipeline's five steps rather than an indeterminate spinner.
 *
 * No artboard exists for the flow (plan §8): built from existing primitives, tokens and motion
 * only, and replaced wholesale when one arrives. Every kind runs through here — the header and
 * the step hints read off `kind` rather than naming the resume.
 */
export function GenerationScreen({ id }: GenerationScreenProps) {
  const { spacing, s } = useTheme();
  const actions = useGenerationsActions();

  const generation = useGeneration(id);
  const retry = useRetryGeneration();
  const run: Generation | undefined = generation.data;
  const status = run?.status;
  const resume = useResume(run?.resumeId ?? '');
  // Disabled until the run is ready — a disabled query stays pending, so the CTA above tests the
  // same flag before it reads `isPending`.
  const interviewSet = useInterviewSetForGeneration(
    generation.data?.kind === 'interview' && generation.data.status === 'ready' ? id : '',
  );

  // The first wait anyone has on us is the moment to offer a tap when it's done.
  const waiting = status === 'queued' || status === 'generating';
  useEffect(() => {
    if (waiting) void offerPushForRun();
  }, [waiting]);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={
        // A job-first tailoring run keeps the flow's own chrome even when it fails (TAILOR 04).
        run?.tailor ? (
          <TailorChrome step="fix" onClose={() => actions.closeFlow(run.jobId)} />
        ) : run?.origin === 'build' ? (
          // BUILD 05's chrome: the ✕ alone, kept when the build fails.
          <TailorChrome onClose={() => actions.closeBuild(run.jobId)} />
        ) : run?.kind === 'cover_letter' ? (
          // COVER 02's chrome too: a failed letter stopped on the Write step.
          <TailorChrome
            stepper={<FlowStepper steps={COVER_STEPS} current="write" />}
            onClose={() => actions.closeFlow(run.jobId)}
          />
        ) : run?.kind === 'zero_resume' ? (
          // ZERO 02's chrome: a failed draft stopped on the Draft step.
          <TailorChrome
            stepper={<FlowStepper steps={ZERO_STEPS} current="draft" />}
            onClose={() => actions.closeFlow(run.jobId)}
          />
        ) : (
          // The run names the screen — 9D sends cover letters and ATS checks through here too,
          // so nothing above says "resume". Before it loads there is no kind to name it by.
          <ScreenHeader
            title={run ? GENERATION_KIND_LABEL[run.kind] : 'Generation'}
            onBack={actions.goBack}
          />
        )
      }
      headerStyle={{ paddingBottom: spacing[4] }}
      contentContainerStyle={{ paddingBottom: spacing[8], gap: spacing[6] }}
      footer={footer}
    >
      {children}
    </Screen>
  );

  if (generation.isPending && id.length > 0) {
    return page(
      <View style={{ gap: spacing[6] }}>
        <Skeleton height={s(132)} radius="cardLg" />
        {/* Step-row metrics, so the list does not jump when the run lands: GenerationSteps draws
            rows at minHeight s(28) in a spacing[3] stack, with the footnote under them. */}
        {/* One block for the five steps and the footnote (§191). */}
        <Skeleton height={s(28) * 5 + spacing[3] * 4 + spacing[6] + s(16)} radius="cardLg" />
      </View>,
    );
  }

  if (generation.isError && !isMissing(generation.error)) {
    return page(
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load this generation"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void generation.refetch()}
      />,
    );
  }

  if (!run) {
    return page(
      <StateView
        icon="Stars02"
        title="This generation has finished or was removed"
        message="Whatever it produced is in your documents."
        actionLabel="Go to Resumes"
        onAction={actions.openResumes}
      />,
    );
  }

  // TAILOR 04–06 (toreview §56): its own progress and ready screens; a failure falls through to
  // the shared one below, under the tailor chrome.
  if (run.tailor && run.status !== 'failed') {
    return <TailorRunView generation={run} run={run.tailor} />;
  }

  // BUILD 05–06 (Home's Build Resume), the same way; a failed build falls through under its ✕.
  if (run.origin === 'build' && run.status !== 'failed') {
    return <BuildRunView generation={run} />;
  }

  // COVER 02–03 (toreview §71), the same way; a failed letter falls through under cover chrome.
  if (run.kind === 'cover_letter' && run.status !== 'failed') {
    return <CoverRunView generation={run} />;
  }

  // ZERO 02–05 (toreview §72), the same way; a failed draft falls through under zero chrome.
  if (run.kind === 'zero_resume' && run.status !== 'failed') {
    return <ZeroRunView generation={run} />;
  }

  // ATS 02–03 (toreview §73): a check against a job. An older check with no job keeps the
  // shared screen below and its score panel.
  if (run.kind === 'ats_check' && run.jdId && run.status !== 'failed') {
    return <AtsRunView generation={run} />;
  }

  if (run.status === 'failed') {
    // A failure is usually a bad input, so the second way out is the description itself: the saved
    // draft when the run came from one, else the job the run was tailored to — §7.5's intake,
    // which is the only other place that description can be changed.
    const { jdId, jobId } = run;
    // A tailoring run's input is the comparison, a letter's is a resume and a tone, and a Zero
    // Resume's is "About you" — none is a description the intake can edit (§173).
    const fixInput =
      run.tailor || run.kind === 'cover_letter' || run.kind === 'zero_resume'
        ? undefined
        : jdId
          ? () => actions.editJd(jdId)
          : jobId
            ? () => actions.editJobDescription(jobId)
            : undefined;

    // A tailoring run goes back to Customize, with its resume and the choices it was given.
    const tailorSource = run.tailor?.sourceResumeId;
    const changeChoices =
      run.tailor && (jobId || jdId)
        ? () =>
            actions.backToCustomize(
              jobId ? { jobId, resumeId: tailorSource } : { jdId, resumeId: tailorSource },
            )
        : undefined;

    return page(
      // Fades in over the progress it replaces rather than cutting to it (§85).
      <Reveal stateKey="failed" style={{ gap: spacing[6] }}>
        {/* Distinct from the load error above on purpose: this run reached the pipeline and
            stopped inside it, so the reason is the run's own and the recovery is to run it
            again. */}
        <StateView
          tone="danger"
          icon="AlertTriangle"
          title="Generation failed"
          message={run.error ?? 'It stopped part-way through. Nothing was saved.'}
          actionLabel="Try again"
          // §7.6 forbids a silent hang, and a second tap mid-flight would queue a second run.
          onAction={() => {
            if (retry.isPending) return;
            retry.mutate(run.id);
          }}
          secondaryLabel={
            changeChoices ? 'Change my choices' : fixInput ? 'Edit the job description' : undefined
          }
          onSecondary={changeChoices ?? fixInput}
        />
        {retry.isError ? (
          <Text variant="caption" color="danger" align="center" accessibilityLiveRegion="polite">
            {"We couldn't start it again. Press Try again."}
          </Text>
        ) : null}
      </Reveal>,
    );
  }

  const ready = run.status === 'ready';
  const score = RING_KINDS.includes(run.kind) ? resume.data?.atsScore : undefined;
  const resumeId = run.resumeId;
  const interview = run.kind === 'interview';
  // A run that produced no document (an interview set, Phase 9I) still needs a way out of the
  // finished screen, and the library is the honest one.
  const openDoc = resumeId
    ? { label: documentLabel(run.kind), onPress: () => actions.openDocument(resumeId) }
    : { label: 'Back to your resumes', onPress: actions.openResumes };
  const viewScore =
    resumeId && SCORE_KINDS.includes(run.kind)
      ? { label: 'View score', onPress: () => actions.openScore(resumeId) }
      : undefined;
  // §7.15: the run's output is a set, found by the run's id once it exists. A set that has since
  // been deleted resolves null, and the library is the honest fallback rather than a dead link.
  const setId = interviewSet.data?.id;
  const openSet = interview
    ? setId
      ? { label: INTERVIEW_CTA, onPress: () => actions.openInterviewSet(setId) }
      : interviewSet.isPending
        ? { label: INTERVIEW_CTA, loading: true }
        : { label: 'Back to Interview prep', onPress: actions.openInterviewLibrary }
    : undefined;

  return page(
    <>
      <GenerationHero generation={run} score={score} />
      <GenerationSteps generation={run} />
      {ready ? null : (
        // Fades out as the run lands, while the bar below fades in, rather than both cutting.
        <Reveal stateKey="leave-note">
          <Text variant="caption" color="textTertiary" align="center">
            {LEAVE_NOTE}
          </Text>
        </Reveal>
      )}
    </>,
    ready ? (
      <Reveal stateKey="ready-bar">
        <StickyActionBar
          primary={openSet ?? viewScore ?? openDoc}
          secondary={openSet ? undefined : viewScore ? openDoc : undefined}
        />
      </Reveal>
    ) : undefined,
  );
}
