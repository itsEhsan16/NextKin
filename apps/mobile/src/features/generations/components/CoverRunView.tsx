import { useCallback, useState } from 'react';

import type { CoverLetterContent, DocumentContent, Generation } from '@/data/models';
import { useJob, useResume, useResumeContent } from '@/data/queries';
import { COVER_STEPS, FlowStepper } from '@/features/create/components/TailorStepper';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Toast } from '@/ui/Toast';
import { Reveal } from '@/ui/motion';

import { useCoverTone } from '../hooks/useCoverTone';
import { useGenerationsActions } from '../hooks/useGenerationsActions';
import { useTailorDownload } from '../hooks/useTailorDownload';
import { CoverProgress } from './CoverProgress';
import { CoverReady } from './CoverReady';
import { TailorChrome } from './TailorChrome';

export type CoverRunViewProps = { generation: Generation };

// Stepper → first block at 390: the drawing on COVER 02 (644:89 → 656:51); COVER 03's hero sits
// lower on the board over an empty band, closed up here to the spacer under its stepper (644:168).
const STEPS_TO_ART = 39 / 0.75;
const STEPS_TO_HERO = 18 / 0.75;

/** What the toast says once the share sheet has taken the file. */
export const COVER_SAVED_NOTICE = 'Cover letter saved as PDF';

const letterBody = (body: DocumentContent | undefined): CoverLetterContent | undefined =>
  body?.kind === 'cover_letter' ? body : undefined;

/**
 * COVER 02–03 (644:84 / 644:148): a cover-letter run, watched and then delivered. While the
 * pipeline runs it is COVER 02's checklist; once ready it is COVER 03's letter, the other tones
 * and Download PDF. The letter is written from a tailored resume (`sourceResumeId`); `resumeId`
 * is the letter itself.
 */
export function CoverRunView({ generation }: CoverRunViewProps) {
  const { spacing, s } = useTheme();
  const actions = useGenerationsActions();
  const letterId = generation.resumeId ?? '';
  const ready = generation.status === 'ready';

  const job = useJob(generation.jobId ?? '');
  const source = useResume(generation.sourceResumeId ?? '');
  const content = useResumeContent(ready ? letterId : '');

  const [notice, setNotice] = useState<string | null>(null);
  const onSaved = useCallback(() => setNotice(COVER_SAVED_NOTICE), []);
  const download = useTailorDownload(letterId, onSaved, setNotice);
  const tone = useCoverTone(generation, setNotice);

  // The run keeps going without this screen; the notification says when it lands.
  const close = () => actions.closeFlow(generation.jobId);
  const edit = () => {
    if (letterId) actions.openDocument(letterId);
  };

  const stepper = <FlowStepper steps={COVER_STEPS} current={ready ? 'download' : 'write'} />;

  return (
    <>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<TailorChrome stepper={stepper} onClose={close} />}
        headerStyle={{ paddingBottom: s(ready ? STEPS_TO_HERO : STEPS_TO_ART) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        footer={
          ready ? (
            // Arrives with the letter, fading in rather than appearing under it (§85).
            <Reveal stateKey="ready">
              <StickyActionBar
                floating
                primary={{
                  label: 'Download PDF',
                  icon: 'Download01',
                  haptic: 'medium',
                  loading: download.busy,
                  onPress: download.download,
                }}
              />
            </Reveal>
          ) : undefined
        }
      >
        {/* The letter fades in over the progress card instead of cutting to it. */}
        <Reveal stateKey={ready ? 'ready' : 'writing'}>
          {ready ? (
            <CoverReady
              letter={letterBody(content.data)}
              letterError={content.isError}
              onRetryLetter={() => void content.refetch()}
              onEdit={edit}
              job={job.data}
              resumeTitle={source.data?.title}
              tones={tone.tones}
              onPickTone={tone.pick}
              tonesDisabled={tone.disabled}
              quotaSpent={tone.spent}
            />
          ) : (
            <CoverProgress generation={generation} />
          )}
        </Reveal>
      </Screen>

      <Toast
        visible={notice != null}
        message={notice ?? ''}
        // The saved confirmation is the one success; every other notice is a failure.
        tone={notice === COVER_SAVED_NOTICE ? 'success' : 'error'}
        onHide={() => setNotice(null)}
      />
    </>
  );
}
