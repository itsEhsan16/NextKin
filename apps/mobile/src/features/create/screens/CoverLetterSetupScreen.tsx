import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import type { CoverLetterTone } from '@/data/models';
import { useJob, useResume, useResumes, useStartGeneration, useSubscription } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useRevealStagger } from '@/ui/motion';

import { CoverJobSheet } from '../components/CoverJobSheet';
import { CoverLetterSkeleton } from '../components/CoverLetterSkeleton';
import { CoverSetupSections } from '../components/CoverSetupRows';
import { COVER_STEPS, FlowStepper } from '../components/TailorStepper';
import {
  COVER_LETTER_CTA,
  COVER_LETTER_START_FAILED,
  coverLetterQuotaNote,
  coverLetterSources,
  coverLetterSpentNote,
  DEFAULT_COVER_LETTER_TONE,
  pickCoverLetterSource,
} from '../coverLetterSetup';
import { useCreateActions } from '../hooks/useCreateActions';

export type CoverLetterSetupScreenProps = { resumeId?: string };

// COVER 01 at 390 (644:2), in artboard units.
const HEADER_TO_STEPS = 12 / 0.75; // 644:6
const STEPS_TO_ART = 37 / 0.75; // 644:7 → 656:60

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'NOT_FOUND';

/**
 * COVER 01 (644:2) — "Cover letter for this job": the job, the resume tailored for it, and the
 * tone (V2 §7.10). Either row reopens the job sheet, which lists each job with the resume
 * tailored for it, so job and resume always change together. The quota line sits on the bar,
 * over the button that spends it, so the cap is said before the work (§13.5); once it is spent
 * the upgrade prompt REPLACES the CTA rather than interrupting the page, as the same section asks.
 *
 * Opened with no resume (Home's tile, the + sheet), the page starts on the most recently edited
 * tailored resume; with none, it says so and points to Jobs, where tailoring starts. Opened from
 * the resume menu on a resume tailored for no job, the page drops the Job section and the letter
 * is written without a job, as before.
 */
export function CoverLetterSetupScreen({ resumeId }: CoverLetterSetupScreenProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useCreateActions();

  // Without a resume named, the library's own order picks one (COVER 00's sheet is gone, §71).
  const resumes = useResumes();
  const sources = useMemo(() => coverLetterSources(resumes.data ?? []), [resumes.data]);
  const sourceId = resumeId ?? pickCoverLetterSource(sources)?.id;
  const resume = useResume(sourceId ?? '');
  const jobId = resume.data?.linkedJobId;
  const job = useJob(jobId ?? '');
  const subscription = useSubscription();
  const start = useStartGeneration();

  const [tone, setTone] = useState<CoverLetterTone>(DEFAULT_COVER_LETTER_TONE);
  const [pickerOpen, setPickerOpen] = useState(false);

  // `accessibilityLiveRegion` on the bar's note is Android-only, so the failure is announced
  // explicitly as well — once per falsy→truthy turn, the way TextField announces its error.
  const failed = start.isError;
  const announced = useRef(false);
  useEffect(() => {
    const was = announced.current;
    announced.current = failed;
    if (failed && !was) AccessibilityInfo.announceForAccessibility(COVER_LETTER_START_FAILED);
  }, [failed]);

  // Sections fade up in turn only when loaded data replaces the skeleton; a screen that opens
  // with its data already here slides in whole with the push.
  const enter = useRevealStagger(
    !!resume.data && !!subscription.data && !(jobId != null && job.isPending),
  );

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={
          <ScreenHeader title="Write a cover letter" showTitle={false} onBack={actions.goBack} />
        }
        headerStyle={{ paddingBottom: s(HEADER_TO_STEPS) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        footer={footer}
      >
        <FlowStepper steps={COVER_STEPS} current="setup" />
        <View style={{ marginTop: s(STEPS_TO_ART) }}>{children}</View>
      </Screen>

      {/* Sibling of the page, never a child of its scroller: its root is an absolute fill. */}
      <CoverJobSheet
        open={pickerOpen}
        selectedResumeId={sourceId}
        onClose={() => setPickerOpen(false)}
        onContinue={(id) => {
          setPickerOpen(false);
          // Swapped in place, so back still leaves the flow in one step.
          if (id !== sourceId) actions.compareResume(id);
        }}
      />
    </View>
  );

  // The inert bar is part of the loading state: it owns the bottom safe-area inset, so a page
  // without one would grow a footer out of nothing the moment the queries land.
  const inert = <StickyActionBar floating primary={{ label: COVER_LETTER_CTA, disabled: true }} />;

  const retryState = (title: string, onAction: () => void) => (
    <StateView
      tone="danger"
      icon="exclamation-triangle"
      title={title}
      message="Check your connection and try again."
      actionLabel="Try again"
      onAction={onAction}
    />
  );

  if (resumeId == null && resumes.isError) {
    return page(retryState("Couldn't load your resumes", () => void resumes.refetch()));
  }

  if (resumeId == null && resumes.data && sources.length === 0) {
    return page(
      <StateView
        icon="magic"
        title="No tailored resumes yet"
        message="A letter is written from a resume you tailored for the job. Tailor one first."
        actionLabel="Find a job to tailor for"
        onAction={actions.openJobs}
      />,
      inert,
    );
  }

  if (sourceId != null && resume.isError) {
    return isNotFound(resume.error)
      ? page(
          <StateView
            icon="file-alt"
            title="This resume isn't available"
            message="It may have been deleted. Pick the job the letter is for."
            actionLabel="Choose a job"
            onAction={() => setPickerOpen(true)}
          />,
        )
      : page(retryState("Couldn't load your resume", () => void resume.refetch()));
  }

  // An allowance that could not be read is unknown, not unlimited: §13.5 wants the cap in front
  // of the user before the work, so nothing is spent against a cap the page never showed.
  if (subscription.isError) {
    return page(retryState("Couldn't load your plan", () => void subscription.refetch()));
  }

  if (jobId != null && job.isError && !isNotFound(job.error)) {
    return page(retryState("Couldn't load this job", () => void job.refetch()));
  }

  if (!resume.data || !subscription.data || (jobId != null && job.isPending)) {
    return page(<CoverLetterSkeleton />, inert);
  }

  const source = resume.data;
  // A job that has since closed leaves the letter to the resume alone, as for an untailored one.
  const target = job.data;
  const { coverLettersUsed: used, coverLettersLimit: limit } = subscription.data.usage;
  // A plan that grants none is spent rather than unlimited — 0 of 0 leaves nothing to write.
  const spent = used >= limit;

  const write = () =>
    start.mutate(
      {
        kind: 'cover_letter',
        sourceResumeId: source.id,
        ...(source.linkedJobId ? { jobId: source.linkedJobId } : {}),
        tone,
      },
      // Navigate from the callback, not beside the call: the mock ticker only advances while the
      // progress screen is subscribed, and pushing first races the destination's own fetch.
      { onSuccess: (generation) => actions.openGeneration(generation.id) },
    );

  return page(
    <CoverSetupSections
      job={target}
      resume={source}
      tone={tone}
      onTone={setTone}
      onPick={() => setPickerOpen(true)}
      enter={enter}
    />,
    // A failure leaves the button live, so a second press is the retry.
    <StickyActionBar
      floating
      note={
        failed
          ? COVER_LETTER_START_FAILED
          : spent
            ? coverLetterSpentNote(limit)
            : coverLetterQuotaNote(used, limit)
      }
      noteTone={failed ? 'danger' : 'neutral'}
      primary={
        spent
          ? { label: 'See Pro plans', onPress: () => actions.openUpgrade('cover_letters') }
          : { label: COVER_LETTER_CTA, loading: start.isPending, onPress: write }
      }
    />,
  );
}

const useStyles = scaledSheet(() => ({
  root: { flex: 1 },
}));
