import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { JdInput, Resume } from '@/data/models';
import {
  isUnreadableFileError,
  useExtractJd,
  useImportResume,
  useSavedJobs,
  useStartGeneration,
  useSubscription,
} from '@/data/queries';
import { pickDocument, type PickedDocument } from '@/lib';
import { scaledSheet, useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { StateView } from '@/ui/StateView';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { useRevealStagger } from '@/ui/motion';

import {
  ATS_CTA,
  ATS_LEDE,
  ATS_TITLE,
  atsBlocker,
  atsCheckAllowance,
  atsChecksLeftNote,
  atsChecksSpentNote,
  CHECK_FAILED,
  UPGRADE_CTA,
  type AtsJobMode,
} from '../atsCheckSetup';
import { AtsCheckSkeleton } from '../components/AtsCheckSkeleton';
import { AtsJobSheet } from '../components/AtsJobSheet';
import { AtsJobPart } from '../components/AtsJobPart';
import { AtsFileRow, type AtsFileState } from '../components/AtsCheckRows';
import { FLOW_ART, FlowHero } from '../components/FlowHero';
import { UploadPromptRow } from '../components/TailorResumeRows';
import { uploadedMeta } from '../components/tailorResumeMeta';
import { useCreateActions } from '../hooks/useCreateActions';

export type AtsCheckScreenProps = {
  /** Opens against this saved job instead of the most recent one. */
  jobId?: string;
};

// ATS 01 / 01b at 390 (645:3 / 645:49), in artboard units.
const HEADER_TO_ART = 14 / 0.75; // 645:7
const HERO_TO_FILE: Record<AtsJobMode, number> = { job: 22 / 0.75, paste: 16 / 0.75 };

type Upload =
  | { file: PickedDocument; status: Exclude<AtsFileState, 'ready'> }
  | { file: PickedDocument; status: 'ready'; resume: Resume };

/**
 * ATS 01 / 01b (645:3, 645:49) — "Check your resume": a resume made outside NextKin, read on
 * upload, checked against a saved job (the most recent one, with Change) or a pasted description
 * (V2 §7.8, toreview §73). A job is always set, so every result can carry a score (D-15).
 *
 * The file is read the moment it is picked, so the row can say what was read and a scan is
 * refused before anything is spent. The quota sits on the bar, over the button that spends it.
 */
export function AtsCheckScreen({ jobId }: AtsCheckScreenProps) {
  const { spacing, s } = useTheme();
  const styles = useStyles();
  const actions = useCreateActions();

  const savedJobs = useSavedJobs();
  const subscription = useSubscription();
  const importResume = useImportResume();
  const extract = useExtractJd();
  const start = useStartGeneration();

  const [upload, setUpload] = useState<Upload | null>(null);
  const [mode, setMode] = useState<AtsJobMode>('job');
  const [pickedJobId, setPickedJobId] = useState(jobId);
  const [pasted, setPasted] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refused, setRefused] = useState(false);
  const [failed, setFailed] = useState(false);

  const jobs = savedJobs.data ?? [];
  const job = jobs.find((item) => item.id === pickedJobId) ?? jobs[0];

  const chooseFile = async () => {
    const file = await pickDocument(['pdf', 'docx']);
    if (!file) return;
    setFailed(false);
    setUpload({ file, status: 'reading' });
    try {
      const { resume } = await importResume.mutateAsync(file);
      setUpload({ file, status: 'ready', resume });
    } catch (error) {
      setUpload({ file, status: isUnreadableFileError(error) ? 'unreadable' : 'failed' });
    }
  };

  // Sections fade up in turn only when loaded data replaces the skeleton; a screen that opens
  // with its data already here slides in whole with the push.
  const enter = useRevealStagger(!savedJobs.isPending && !subscription.isPending);

  const page = (children: ReactNode, footer?: ReactNode) => (
    <View style={styles.root}>
      <Screen
        keyboard
        scroll
        edges={['top', 'bottom']}
        header={<ScreenHeader title="ATS check" showTitle={false} onBack={actions.goBack} />}
        headerStyle={{ paddingBottom: s(HEADER_TO_ART) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        footer={footer}
      >
        {children}
      </Screen>
      {/* Sibling of the page, never a child of its scroller: its root is an absolute fill. */}
      <AtsJobSheet
        open={sheetOpen}
        jobs={jobs}
        selectedId={job?.id}
        onPick={(id) => {
          setPickedJobId(id);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );

  // The inert bar is part of the loading state: it owns the bottom safe-area inset.
  if (savedJobs.isPending || subscription.isPending) {
    return page(
      <AtsCheckSkeleton />,
      <StickyActionBar floating primary={{ label: ATS_CTA, disabled: true }} />,
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
    return retry("Couldn't load your plan", () => void subscription.refetch());
  if (savedJobs.isError)
    return retry("Couldn't load your saved jobs", () => void savedJobs.refetch());

  const allowance = atsCheckAllowance(subscription.data.usage);
  const resume = upload?.status === 'ready' ? upload.resume : undefined;
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
    <>
      <Animated.View entering={enter(0)}>
        <FlowHero
          title={ATS_TITLE}
          lede={ATS_LEDE[mode]}
          art={mode === 'job' ? FLOW_ART.atsUpload : FLOW_ART.atsPaste}
        />
      </Animated.View>
      <Animated.View entering={enter(1)} style={{ marginTop: s(HERO_TO_FILE[mode]) }}>
        {upload ? (
          <AtsFileRow
            fileName={upload.file.name}
            state={upload.status}
            meta={upload.status === 'ready' ? uploadedMeta(upload.resume) : undefined}
            onChange={() => void chooseFile()}
          />
        ) : (
          <UploadPromptRow onPress={() => void chooseFile()} />
        )}
      </Animated.View>
      <Animated.View entering={enter(2)}>
        <AtsJobPart
          mode={mode}
          job={job}
          pasted={pasted}
          onPaste={setPasted}
          onChangeJob={() => setSheetOpen(true)}
          onPasteMode={() => setMode('paste')}
          onJobMode={() => setMode('job')}
          pasteError={refused && mode === 'paste' ? blocker : undefined}
        />
      </Animated.View>
    </>,
    <StickyActionBar
      floating
      note={note}
      noteTone={failed || (refused && blocker) ? 'danger' : 'neutral'}
      primary={
        allowance.spent
          ? { label: UPGRADE_CTA, onPress: () => actions.openUpgrade('ats_checks') }
          : { label: ATS_CTA, loading: busy, onPress: check }
      }
    />,
  );
}

const useStyles = scaledSheet(() => ({
  root: { flex: 1 },
}));
