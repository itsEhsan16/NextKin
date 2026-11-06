import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  nextZeroCheck,
  zeroProgress,
  type DocumentContent,
  type Generation,
  type ResumeContent,
  type ZeroResolution,
} from '@/data/models';
import { useCurrentUser, useJob, useResolveZeroCheck, useResumeContent } from '@/data/queries';
import { FLOW_ART } from '@/features/create/components/FlowHero';
import { FlowStepper, ZERO_STEPS } from '@/features/create/components/TailorStepper';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { StateView } from '@/ui/StateView';
import { FlowFooter } from '@/features/create/flow/FlowKit';
import { EXPORT_BLOCK_MESSAGE } from '@/data/models';
import { Toast } from '@/ui/Toast';
import { Reveal } from '@/ui/motion';

import { useGenerationsActions } from '../hooks/useGenerationsActions';
import { useTailorDownload } from '../hooks/useTailorDownload';
import { TailorChrome } from './TailorChrome';
import { TailorProgress } from './TailorProgress';
import { ZeroReview } from './ZeroReview';
import { ZeroDraftPreview } from './ZeroDraftPreview';
import { ZeroReady } from './ZeroReady';
import {
  ZERO_CARD_TITLE,
  ZERO_FOOTNOTE,
  ZERO_WRITING_LEDE,
  ZERO_WRITING_TITLE,
  zeroProgressRows,
} from './zeroRun';

// Stepper → first block at 390: the drawing on ZERO 02 (613:300 → 661:14), the draft page on
// ZERO 03 (613:384) and the finished page on ZERO 05 (613:644).
const STEPS_TO_ART = 38 / 0.75;
const STEPS_TO_DRAFT = 18 / 0.75;
const STEPS_TO_RESUME = 4 / 0.75;
/** ZERO 03's locked Download is 110 wide at 390 (613:461); Start checking takes the rest. */
/** ZERO 05's Edit is 100 wide (613:708). */

export const ZERO_SAVED_NOTICE = 'Resume saved as PDF';
const SAVE_FAILED = "We couldn't save that. Check your connection and try again.";

const resumeBody = (content: DocumentContent | undefined): ResumeContent | undefined =>
  content?.kind === 'resume' ? content : undefined;

const messageOf = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : SAVE_FAILED;

/**
 * ZERO 02–05 (toreview §72): a Zero Resume run, written, checked and delivered. While the pipeline
 * runs it is ZERO 02's checklist; once the draft exists it is ZERO 03's marked page with ZERO 04's
 * sheet walking each guess; once nothing is left it is ZERO 05, where Download opens (V2 §7.9).
 * The checks live in the document, so leaving and coming back picks up where the reader stopped.
 */
export function ZeroRunView({ generation }: { generation: Generation }) {
  const { spacing, s } = useTheme();
  const actions = useGenerationsActions();
  const router = useRouter();
  const resumeId = generation.resumeId ?? '';
  const ready = generation.status === 'ready';

  const user = useCurrentUser();
  const job = useJob(generation.jobId ?? '');
  const content = useResumeContent(ready ? resumeId : '');
  const resolve = useResolveZeroCheck(resumeId);

  const [sheetError, setSheetError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const onSaved = useCallback(() => setNotice(ZERO_SAVED_NOTICE), []);
  const download = useTailorDownload(resumeId, onSaved, setNotice);

  const body = resumeBody(content.data);
  const progress = body ? zeroProgress(body) : undefined;
  const done = progress != null && progress.left === 0;
  const item = body ? nextZeroCheck(body) : undefined;
  const name =
    generation.zero?.fullName?.trim() ||
    [user.data?.firstName, user.data?.lastName].filter(Boolean).join(' ');

  // The run keeps going without this screen; the notification says when it lands.
  const close = () => actions.closeFlow(generation.jobId);

  const answer = (resolution: ZeroResolution) => {
    setSheetError(undefined);
    resolve.mutate(resolution, {
      // The next guess follows from the saved document; the last one closes the sheet on ZERO 05.
      onSuccess: () => undefined,
      onError: (error) => setSheetError(messageOf(error)),
    });
  };

  const phase = !ready ? 'writing' : done ? 'done' : 'check';
  const stepper = (
    <FlowStepper
      steps={ZERO_STEPS}
      current={phase === 'writing' ? 'draft' : 'check'}
      allDone={phase === 'done'}
    />
  );
  const gap =
    phase === 'writing' ? STEPS_TO_ART : phase === 'done' ? STEPS_TO_RESUME : STEPS_TO_DRAFT;

  let page;
  let footer;
  // Which view is showing, for the cross-fades below.
  let view: 'writing' | 'error' | 'loading' | 'done' | 'check';
  if (phase === 'writing') {
    view = 'writing';
    page = (
      <TailorProgress
        generation={generation}
        title={ZERO_WRITING_TITLE}
        lede={ZERO_WRITING_LEDE}
        cardTitle={ZERO_CARD_TITLE}
        rows={zeroProgressRows(generation)}
        footnote={ZERO_FOOTNOTE}
        art={FLOW_ART.zeroWriting}
      />
    );
    footer = (
      <FlowFooter
        inset
        primary={{
          label: 'Leave and notify me',
          icon: 'Bell01',
          variant: 'outline',
          onPress: close,
        }}
      />
    );
  } else if (content.isError) {
    view = 'error';
    page = (
      <StateView
        tone="danger"
        icon="AlertTriangle"
        title="Couldn't load your draft"
        message="It is saved in Resumes. Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void content.refetch()}
      />
    );
  } else if (!body || !progress) {
    view = 'loading';
    page = <ZeroDraftPreview content={null} name={name} />;
  } else if (phase === 'done') {
    view = 'done';
    page = (
      <ZeroReady
        content={body}
        name={name}
        company={job.data?.company}
        onTailor={() => router.push({ pathname: '/create/build', params: { resumeId } })}
        onEdit={() => actions.openDocument(resumeId)}
      />
    );
    footer = (
      <FlowFooter
        inset
        note={download.emailBlocked ? EXPORT_BLOCK_MESSAGE.email : undefined}
        secondary={{ label: 'Edit', onPress: () => actions.openDocument(resumeId) }}
        primary={{
          label: download.emailBlocked ? 'Try again' : 'Download PDF',
          icon: 'Download01',
          loading: download.busy,
          onPress: download.download,
        }}
      />
    );
  } else {
    view = 'check';
    page = (
      <ZeroReview
        content={body}
        item={item}
        checked={progress.checked}
        total={progress.total}
        busy={resolve.isPending}
        error={sheetError}
        onResolve={answer}
      />
    );
    footer = (
      <FlowFooter
        inset
        note={`Download unlocks at ${progress.total} of ${progress.total}`}
        primary={{
          label: 'Download',
          icon: 'Lock01',
          variant: 'outline',
          disabled: true,
          onPress: () => {},
        }}
      />
    );
  }

  return (
    <>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<TailorChrome stepper={stepper} onClose={close} />}
        headerStyle={{ paddingBottom: s(gap) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        // The bar and the page cross-fade as the run moves on (writing → draft → checked).
        footer={footer ? <Reveal stateKey={view}>{footer}</Reveal> : undefined}
      >
        <Reveal stateKey={view}>{page}</Reveal>
      </Screen>

      <Toast
        visible={notice != null}
        message={notice ?? ''}
        // The saved confirmation is the one success; every other notice is a failure.
        tone={notice === ZERO_SAVED_NOTICE ? 'success' : 'error'}
        onHide={() => setNotice(null)}
      />
    </>
  );
}
