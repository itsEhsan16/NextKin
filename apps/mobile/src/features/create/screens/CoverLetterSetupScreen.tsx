import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  COVER_LETTER_TONE_HINT,
  COVER_LETTER_TONE_LABEL,
  type CoverLetterTone,
  type Job,
  type Resume,
} from '@/data/models';
import { useJob, useResume, useResumes, useStartGeneration, useSubscription } from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { ChoiceChip } from '@/ui/ChoiceChip';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { useRevealStagger } from '@/ui/motion';

import { CoverJobSheet } from '../components/CoverJobSheet';
import { CoverLetterSkeleton } from '../components/CoverLetterSkeleton';
import { OnboardingFrame } from '../components/OnboardingFrame';
import { jobMetaLine } from '../components/TailorVsCard';
import {
  COVER_LETTER_CTA,
  COVER_LETTER_START_FAILED,
  COVER_LETTER_TONES,
  coverLetterQuotaNote,
  coverLetterSources,
  coverLetterSpentNote,
  DEFAULT_COVER_LETTER_TONE,
  pickCoverLetterSource,
} from '../coverLetterSetup';
import { FlowCard, FlowDivider, FlowFooter, FlowSection, StatusPill } from '../flow/FlowKit';
import { useCreateActions } from '../hooks/useCreateActions';

export type CoverLetterSetupScreenProps = { resumeId?: string };

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'NOT_FOUND';

/** The job the letter is for and the resume it is written from, in one card (§173). */
function CoverSourceCard({
  job,
  resume,
  onChange,
}: {
  job?: Job;
  resume: Resume;
  onChange: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const title = job?.title ?? resume.targetRole ?? resume.title;
  const meta = job ? jobMetaLine(job) : 'Written from this resume alone';
  const initial = (job?.company ?? resume.targetCompany ?? title).trim().charAt(0).toUpperCase();
  return (
    <FlowCard style={styles.sourceCard}>
      <View style={styles.sourceRow}>
        <View style={[styles.logo, { backgroundColor: colors.surfaceSubtle }]}>
          <Text variant="title3" color="ink">
            {initial}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="bodyLgStrong" color="ink">
            {title}
          </Text>
          <Text variant="footnote" color="textSecondary">
            {meta}
          </Text>
        </View>
        <Pressable
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel={`Job: ${title}, ${meta}. Change`}
          onPress={onChange}
          style={[styles.change, { backgroundColor: colors.surfaceSubtle }]}
        >
          <Text variant="footnote" color="ink">
            Change
          </Text>
        </Pressable>
      </View>
      <FlowDivider />
      <View style={styles.usingRow}>
        <Icon name="File04" size="sm" color={colors.textSecondary} />
        <Text variant="footnote" color="textSecondary">
          Using
        </Text>
        <Text variant="footnote" color="ink" numberOfLines={1} style={styles.shrink}>
          {resume.title}
        </Text>
        {resume.atsScore != null ? (
          <StatusPill label={`ATS ${(Math.round(resume.atsScore) / 10).toFixed(1)}`} />
        ) : null}
      </View>
    </FlowCard>
  );
}

/**
 * Cover Letter, step 1 of 2 (toreview §173, Figma "Cover · 1 Set up"): the job and the resume it
 * is written from in one card (they used to be two rows opening the same sheet), the tone as one
 * row of chips with its one-line meaning, and Write my cover letter. Only the resume is required:
 * the job comes from the resume it was tailored for, and the tone defaults to Professional.
 */
export function CoverLetterSetupScreen({ resumeId }: CoverLetterSetupScreenProps) {
  const styles = useStyles();
  const actions = useCreateActions();

  // Without a resume named, the library's own order picks one (§71).
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

  // `accessibilityLiveRegion` on the note is Android-only, so the failure is announced as well.
  const failed = start.isError;
  const announced = useRef(false);
  useEffect(() => {
    const was = announced.current;
    announced.current = failed;
    if (failed && !was) AccessibilityInfo.announceForAccessibility(COVER_LETTER_START_FAILED);
  }, [failed]);

  const enter = useRevealStagger(
    !!resume.data && !!subscription.data && !(jobId != null && job.isPending),
  );

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <OnboardingFrame
        step={1}
        total={2}
        title="Write a cover letter"
        subtitle={job.data ? 'From the resume you tailored for this job.' : 'From your resume.'}
        onBack={actions.goBack}
        footer={footer}
      >
        {children}
      </OnboardingFrame>

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

  const inert = (
    <FlowFooter primary={{ label: COVER_LETTER_CTA, onPress: () => {}, disabled: true }} />
  );

  const retryState = (title: string, onAction: () => void) => (
    <StateView
      tone="danger"
      icon="AlertTriangle"
      title={title}
      message="Check your connection and try again."
      actionLabel="Try again"
      onAction={onAction}
    />
  );

  if (resumeId == null && resumes.isError) {
    return page(retryState('Couldn’t load your resumes', () => void resumes.refetch()));
  }

  if (resumeId == null && resumes.data && sources.length === 0) {
    return page(
      <StateView
        icon="Stars02"
        title="No tailored resumes yet"
        message="Tailor a resume for a job first."
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
            icon="File06"
            title="This resume isn’t available"
            message="It may have been deleted. Pick the job the letter is for."
            actionLabel="Choose a job"
            onAction={() => setPickerOpen(true)}
          />,
        )
      : page(retryState('Couldn’t load your resume', () => void resume.refetch()));
  }

  // An allowance that could not be read is unknown, not unlimited (§13.5).
  if (subscription.isError) {
    return page(retryState('Couldn’t load your plan', () => void subscription.refetch()));
  }

  if (jobId != null && job.isError && !isNotFound(job.error)) {
    return page(retryState('Couldn’t load this job', () => void job.refetch()));
  }

  if (!resume.data || !subscription.data || (jobId != null && job.isPending)) {
    return page(<CoverLetterSkeleton />, inert);
  }

  const source = resume.data;
  // A job that has since closed leaves the letter to the resume alone.
  const target = job.data;
  const { coverLettersUsed: used, coverLettersLimit: limit } = subscription.data.usage;
  // A plan that grants none is spent rather than unlimited.
  const spent = used >= limit;

  const write = () =>
    start.mutate(
      {
        kind: 'cover_letter',
        sourceResumeId: source.id,
        ...(source.linkedJobId ? { jobId: source.linkedJobId } : {}),
        tone,
      },
      // Navigate from the callback: the mock ticker only advances while the progress screen is
      // subscribed, and pushing first races the destination's own fetch.
      { onSuccess: (generation) => actions.openGeneration(generation.id) },
    );

  return page(
    <View style={styles.stack}>
      <Animated.View entering={enter(0)}>
        <CoverSourceCard job={target} resume={source} onChange={() => setPickerOpen(true)} />
      </Animated.View>
      <Animated.View entering={enter(1)}>
        <FlowSection title="Tone">
          <View style={styles.chips} accessibilityRole="radiogroup">
            {COVER_LETTER_TONES.map((option) => (
              <ChoiceChip
                key={option}
                radio
                label={COVER_LETTER_TONE_LABEL[option]}
                selected={option === tone}
                onPress={() => setTone(option)}
              />
            ))}
          </View>
          <Text variant="callout" color="textSecondary" style={styles.hint}>
            {COVER_LETTER_TONE_HINT[tone]}
          </Text>
        </FlowSection>
      </Animated.View>
    </View>,
    // A failure leaves the button live, so a second press is the retry.
    <FlowFooter
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
          : { label: COVER_LETTER_CTA, icon: 'Stars02', loading: start.isPending, onPress: write }
      }
    />,
  );
}

const useStyles = scaledSheet((_s, u) => ({
  root: { flex: 1 },
  stack: { gap: u(24) },
  flex: { flex: 1, gap: u(2) },
  shrink: { flexShrink: 1 },
  sourceCard: { gap: u(14) },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: u(12) },
  logo: {
    width: u(44),
    height: u(44),
    borderRadius: u(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  change: { paddingHorizontal: u(14), paddingVertical: u(7), borderRadius: u(999) },
  usingRow: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
  hint: { marginTop: u(10) },
}));
