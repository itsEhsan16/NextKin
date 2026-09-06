import { useEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';

import { GENERATION_KIND_LABEL, type Generation, type GenerationKind } from '@/data/models';
import {
  useGeneration,
  useInterviewSetForGeneration,
  useResume,
  useRetryGeneration,
} from '@/data/queries';
import { haptics } from '@/lib';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Text } from '@/ui/Text';

import { GenerationHero } from '../components/GenerationHero';
import { GenerationSteps } from '../components/GenerationSteps';
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

  // One buzz per finished run: the ticker keeps writing into the cache after 'ready' lands, and
  // a re-render must not buzz again.
  const celebrated = useRef(false);
  useEffect(() => {
    if (status !== 'ready' || celebrated.current) return;
    celebrated.current = true;
    haptics.success();
  }, [status]);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <Screen
      scroll
      edges={['top', 'bottom']}
      header={
        // The run names the screen — 9D sends cover letters and ATS checks through here too, so
        // nothing above says "resume". Before it loads there is no kind to name it by.
        <ScreenHeader
          title={run ? GENERATION_KIND_LABEL[run.kind] : 'Generation'}
          onBack={actions.goBack}
        />
      }
      contentContainerStyle={{
        paddingTop: spacing[5],
        paddingBottom: spacing[8],
        gap: spacing[6],
      }}
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
        <View style={{ gap: spacing[3] }}>
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} width="70%" height={s(28)} />
          ))}
        </View>
        <Skeleton width="80%" height={s(16)} style={{ alignSelf: 'center' }} />
      </View>,
    );
  }

  if (generation.isError && !isMissing(generation.error)) {
    return page(
      <StateView
        tone="danger"
        icon="exclamation-triangle"
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
        icon="magic"
        title="This generation has finished or was removed"
        message="Whatever it produced is in your documents."
        actionLabel="Go to Resumes"
        onAction={actions.openResumes}
      />,
    );
  }

  if (run.status === 'failed') {
    // A failure is usually a bad input, so the second way out is the description itself: the saved
    // draft when the run came from one, else the job the run was tailored to — §7.5's intake,
    // which is the only other place that description can be changed.
    const { jdId, jobId } = run;
    const fixInput = jdId
      ? () => actions.editJd(jdId)
      : jobId
        ? () => actions.editJobDescription(jobId)
        : undefined;

    return page(
      <>
        {/* Distinct from the load error above on purpose: this run reached the pipeline and
            stopped inside it, so the reason is the run's own and the recovery is to run it
            again. */}
        <StateView
          tone="danger"
          icon="exclamation-triangle"
          title="Generation failed"
          message={run.error ?? 'It stopped part-way through. Nothing was saved.'}
          actionLabel="Try again"
          // §7.6 forbids a silent hang, and a second tap mid-flight would queue a second run.
          onAction={() => {
            if (retry.isPending) return;
            retry.mutate(run.id);
          }}
          secondaryLabel={fixInput ? 'Edit the job description' : undefined}
          onSecondary={fixInput}
        />
        {retry.isError ? (
          <Text variant="caption" color="danger" align="center" accessibilityLiveRegion="polite">
            {"We couldn't start it again. Press Try again."}
          </Text>
        ) : null}
      </>,
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
        <Text variant="caption" color="textTertiary" align="center">
          {LEAVE_NOTE}
        </Text>
      )}
    </>,
    ready ? (
      <StickyActionBar
        primary={openSet ?? viewScore ?? openDoc}
        secondary={openSet ? undefined : viewScore ? openDoc : undefined}
      />
    ) : undefined,
  );
}
