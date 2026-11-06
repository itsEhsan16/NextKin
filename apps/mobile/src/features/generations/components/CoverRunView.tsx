import { useCallback, useState } from 'react';

import type { CoverLetterContent, DocumentContent, Generation } from '@/data/models';
import { useJob, useResume, useResumeContent } from '@/data/queries';
import { EXPORT_BLOCK_MESSAGE } from '@/data/models';
import { FlowFooter } from '@/features/create/flow/FlowKit';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { Toast } from '@/ui/Toast';
import { Reveal } from '@/ui/motion';

import { useCoverTone } from '../hooks/useCoverTone';
import { useGenerationsActions } from '../hooks/useGenerationsActions';
import { useTailorDownload } from '../hooks/useTailorDownload';
import { CoverReady } from './CoverReady';
import { TailorChrome } from './TailorChrome';
import { TailorProgress } from './TailorProgress';
import {
  COVER_CARD_TITLE,
  COVER_HONESTY_NOTE,
  COVER_WRITING_TITLE,
  coverProgressRows,
  coverWritingLede,
} from './coverRun';

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

  return (
    <>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<TailorChrome onClose={close} />}
        headerStyle={{ paddingBottom: s(ready ? STEPS_TO_HERO : STEPS_TO_ART) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        footer={
          <Reveal stateKey={ready ? 'ready' : 'writing'}>
            {ready ? (
              <FlowFooter
                inset
                note={download.emailBlocked ? EXPORT_BLOCK_MESSAGE.email : undefined}
                secondary={{ label: 'Edit', onPress: edit }}
                primary={{
                  label: download.emailBlocked ? 'Try again' : 'Download PDF',
                  icon: 'Download01',
                  loading: download.busy,
                  onPress: download.download,
                }}
              />
            ) : (
              // The run keeps going without this screen; the notification says when it lands.
              <FlowFooter
                inset
                note={COVER_HONESTY_NOTE}
                primary={{
                  label: 'Leave and notify me',
                  icon: 'Bell01',
                  variant: 'outline',
                  onPress: close,
                }}
              />
            )}
          </Reveal>
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
            <TailorProgress
              generation={generation}
              title={COVER_WRITING_TITLE}
              lede={coverWritingLede(generation.jobId != null)}
              cardTitle={COVER_CARD_TITLE}
              rows={coverProgressRows(generation)}
              footnote={null}
            />
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
