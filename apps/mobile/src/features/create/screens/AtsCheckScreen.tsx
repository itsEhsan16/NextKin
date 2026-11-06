import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { defaultTailorPick, tailorableResumes, type JdInput } from '@/data/models';
import {
  useExtractJd,
  useResumes,
  useSavedJobs,
  useStartGeneration,
  useSubscription,
} from '@/data/queries';
import { scaledSheet, useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Pressable } from '@/ui/Pressable';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { StateView } from '@/ui/StateView';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { useRevealStagger } from '@/ui/motion';

import {
  ATS_CTA,
  ATS_TITLE,
  atsBlocker,
  atsCheckAllowance,
  atsChecksLeftNote,
  atsChecksSpentNote,
  CHECK_FAILED,
  JD_MAX,
  PASTE_TIP,
  UPGRADE_CTA,
  type AtsJobMode,
} from '../atsCheckSetup';
import { AtsCheckSkeleton } from '../components/AtsCheckSkeleton';
import { AtsJobSheet } from '../components/AtsJobSheet';
import { OnboardingFrame } from '../components/OnboardingFrame';
import { TailorResumeSheet } from '../components/TailorResumeSheet';
import { tailorResumeMeta } from '../components/tailorResumeMeta';
import { FlowCard, FlowFooter, IconTile } from '../flow/FlowKit';
import { useCreateActions } from '../hooks/useCreateActions';

export type AtsCheckScreenProps = {
  /** Opens against this saved job instead of the most recent one. */
  jobId?: string;
};

const LEDE = 'See how it reads for one job.';

/** An eyebrow over a part of the form. */
function Label({ children }: { children: string }) {
  return (
    <Text variant="eyebrow" color="textTertiary">
      {children.toUpperCase()}
    </Text>
  );
}

/**
 * ATS Check, step 1 of 2 (toreview §173, Figma "ATS · 1 Set up"): the resume — any you already
 * have (it used to take only an upload), with upload one tap away — and the job, a saved one or a
 * pasted description. One button reads the job and starts the check.
 */
export function AtsCheckScreen({ jobId }: AtsCheckScreenProps) {
  const { colors, u } = useTheme();
  const styles = useStyles();
  const actions = useCreateActions();

  const resumes = useResumes();
  const savedJobs = useSavedJobs();
  const subscription = useSubscription();
  const extract = useExtractJd();
  const start = useStartGeneration();

  const [pickedResumeId, setPickedResumeId] = useState<string>();
  const [mode, setMode] = useState<AtsJobMode>('job');
  const [pickedJobId, setPickedJobId] = useState(jobId);
  const [pasted, setPasted] = useState('');
  const [jobSheet, setJobSheet] = useState(false);
  const [resumeSheet, setResumeSheet] = useState(false);
  const [refused, setRefused] = useState(false);
  const [failed, setFailed] = useState(false);

  const offered = useMemo(() => tailorableResumes(resumes.data ?? []), [resumes.data]);
  const resume =
    offered.find((r) => r.id === pickedResumeId) ??
    (resumes.data ?? []).find((r) => r.id === pickedResumeId) ??
    offered.find((r) => r.id === defaultTailorPick(offered));
  const jobs = savedJobs.data ?? [];
  const job = jobs.find((item) => item.id === pickedJobId) ?? jobs[0];

  const enter = useRevealStagger(
    !savedJobs.isPending && !subscription.isPending && !resumes.isPending,
  );

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <OnboardingFrame
        step={1}
        total={2}
        title={ATS_TITLE}
        subtitle={LEDE}
        onBack={actions.goBack}
        footer={footer}
      >
        {children}
      </OnboardingFrame>
      {/* Siblings of the page, never children of its scroller. */}
      <AtsJobSheet
        open={jobSheet}
        jobs={jobs}
        selectedId={job?.id}
        onPick={(id) => {
          setPickedJobId(id);
          setJobSheet(false);
        }}
        onClose={() => setJobSheet(false)}
      />
      <TailorResumeSheet
        open={resumeSheet}
        job={{ title: job?.title ?? 'this job', ...(job?.company ? { company: job.company } : {}) }}
        selectedResumeId={resume?.id}
        onClose={() => setResumeSheet(false)}
        onCompare={(id) => {
          setPickedResumeId(id);
          setResumeSheet(false);
          setFailed(false);
        }}
      />
    </View>
  );

  if (savedJobs.isPending || subscription.isPending || resumes.isPending) {
    return page(
      <AtsCheckSkeleton />,
      <FlowFooter primary={{ label: ATS_CTA, onPress: () => {}, disabled: true }} />,
    );
  }

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
  // An allowance that could not be read is unknown, not unlimited (§13.5).
  if (subscription.isError)
    return retry('Couldn’t load your plan', () => void subscription.refetch());
  if (savedJobs.isError)
    return retry('Couldn’t load your saved jobs', () => void savedJobs.refetch());
  if (resumes.isError) return retry('Couldn’t load your resumes', () => void resumes.refetch());

  const allowance = atsCheckAllowance(subscription.data.usage);
  const blocker = atsBlocker({ hasFile: resume != null, mode, hasJob: job != null, pasted });
  const busy = extract.isPending || start.isPending;

  const check = () => {
    setFailed(false);
    if (blocker || !resume) {
      setRefused(true);
      return;
    }
    const input: JdInput =
      mode === 'job' && job ? { source: 'job', jobId: job.id } : { source: 'paste', text: pasted };
    extract.mutate(input, {
      onSuccess: (draft) =>
        start.mutate(
          {
            kind: 'ats_check',
            sourceResumeId: resume.id,
            jdId: draft.id,
            ...(mode === 'job' && job ? { jobId: job.id } : {}),
          },
          {
            onSuccess: (generation) => actions.openGeneration(generation.id),
            onError: () => setFailed(true),
          },
        ),
      onError: () => setFailed(true),
    });
  };

  const note = failed
    ? CHECK_FAILED
    : allowance.spent
      ? atsChecksSpentNote(allowance.limit)
      : refused && blocker
        ? blocker
        : allowance.known
          ? atsChecksLeftNote(allowance.used, allowance.limit)
          : undefined;

  return page(
    <View style={styles.stack}>
      <Animated.View entering={enter(0)} style={styles.part}>
        <Label>Resume</Label>
        <Pressable
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel={
            resume ? `Resume: ${resume.title}. Change` : 'Pick or upload a resume'
          }
          onPress={() => setResumeSheet(true)}
        >
          <FlowCard style={styles.row}>
            <View style={[styles.pageTile, { backgroundColor: colors.surfaceSubtle }]}>
              <Icon name="File04" size="md" color={colors.textSecondary} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyLgStrong" color="ink">
                {resume?.title ?? 'Pick a resume'}
              </Text>
              <Text variant="footnote" color="textSecondary">
                {resume ? tailorResumeMeta(resume) : 'Or upload a PDF or DOCX'}
              </Text>
            </View>
            <Icon name="ChevronDown" size="sm" color={colors.textSecondary} />
          </FlowCard>
        </Pressable>
        <Pressable
          feedback="subtle"
          accessibilityRole="button"
          accessibilityLabel="Upload a resume instead"
          onPress={() => setResumeSheet(true)}
          style={styles.inline}
        >
          <Icon name="UploadCloud02" size={u(16)} color={colors.brand} />
          <Text variant="footnote" color="brand">
            Or upload a PDF
          </Text>
        </Pressable>
      </Animated.View>

      <Animated.View entering={enter(1)} style={styles.part}>
        <Label>Job</Label>
        <SegmentedControl
          segments={[
            { key: 'job', label: 'Saved job' },
            { key: 'paste', label: 'Paste' },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === 'job' ? (
          job ? (
            <Pressable
              feedback="subtle"
              accessibilityRole="button"
              accessibilityLabel={`Job: ${job.title}, ${job.company}. Change`}
              onPress={() => setJobSheet(true)}
            >
              <FlowCard highlight style={styles.row}>
                <View style={[styles.logo, { backgroundColor: colors.surfaceSubtle }]}>
                  <Text variant="title3" color="ink">
                    {job.company.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text variant="bodyLgStrong" color="ink">
                    {job.title}
                  </Text>
                  <Text variant="footnote" color="textSecondary">
                    {[job.company, job.location].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <IconTile name="Check" size={24} tone="solid" />
              </FlowCard>
            </Pressable>
          ) : (
            <Text variant="callout" color="textSecondary">
              No saved jobs yet. Paste a description instead.
            </Text>
          )
        ) : (
          <TextField
            accessibilityLabel="Job description"
            placeholder="Paste the whole job description"
            value={pasted}
            onChangeText={setPasted}
            multiline
            minLines={5}
            maxLength={JD_MAX}
            helper={PASTE_TIP}
            error={refused && mode === 'paste' ? (blocker ?? undefined) : undefined}
          />
        )}
        {mode === 'job' && jobs.length > 1 ? (
          <Pressable
            feedback="subtle"
            accessibilityRole="button"
            accessibilityLabel={`See all ${jobs.length} saved jobs`}
            onPress={() => setJobSheet(true)}
            style={styles.inline}
          >
            <Text variant="footnote" color="brand">
              {`See all ${jobs.length} saved jobs`}
            </Text>
            <Icon name="ChevronRight" size={u(14)} color={colors.brand} />
          </Pressable>
        ) : null}
      </Animated.View>
    </View>,
    <FlowFooter
      note={note}
      noteTone={failed || (refused && blocker) ? 'danger' : 'neutral'}
      primary={
        allowance.spent
          ? { label: UPGRADE_CTA, onPress: () => actions.openUpgrade('ats_checks') }
          : { label: ATS_CTA, icon: 'SearchLg', loading: busy, onPress: check }
      }
    />,
  );
}

const useStyles = scaledSheet((_s, u) => ({
  root: { flex: 1 },
  stack: { gap: u(24) },
  part: { gap: u(10) },
  flex: { flex: 1, gap: u(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(12), paddingVertical: u(12) },
  pageTile: {
    width: u(36),
    height: u(44),
    borderRadius: u(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: u(44),
    height: u(44),
    borderRadius: u(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: u(6), alignSelf: 'flex-start' },
}));
