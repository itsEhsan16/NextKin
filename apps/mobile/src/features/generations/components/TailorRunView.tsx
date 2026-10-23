import { useCallback, useState } from 'react';

import type { DocumentContent, Generation, ResumeContent, TailorRun } from '@/data/models';
import {
  EXPORT_BLOCK_MESSAGE,
  useCurrentUser,
  useJob,
  useResume,
  useResumeContent,
} from '@/data/queries';
import { FLOW_ART } from '@/features/create/components/FlowHero';
import { openExternalUrl } from '@/lib';
import { useTheme } from '@/theme';
import { Screen } from '@/ui/Screen';
import { StickyActionBar } from '@/ui/StickyActionBar';
import { Toast } from '@/ui/Toast';
import { Reveal } from '@/ui/motion';

import { useGenerationsActions } from '../hooks/useGenerationsActions';
import { useTailorDownload } from '../hooks/useTailorDownload';
import { ResumePagePreview } from './ResumePagePreview';
import { TailorChrome } from './TailorChrome';
import { TailorProgress } from './TailorProgress';
import { TailorReady } from './TailorReady';
import { savedPagesLabel, TailorSavedSheet, type TailorSavedFile } from './TailorSavedSheet';

export type TailorRunViewProps = {
  generation: Generation;
  /** `generation.tailor`, narrowed by the caller. */
  run: TailorRun;
};

// Stepper → first block: 43 to TAILOR 04's art (608:251 → 661:40), 4 on TAILOR 05 (608:273), at 390.
const STEPS_TO_ART = 43 / 0.75;
const STEPS_TO_PREVIEW = 4 / 0.75;
/** TAILOR 05's Edit button is 100 wide at 390 (608:373); Download PDF takes the rest. */
const EDIT_W = 100 / 0.75;

/** "https://www.stripe.com/jobs" or "stripe.com" → "stripe.com", the host the copy names. */
export function siteHost(website: string): string {
  return (
    website
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split(/[/?#]/)[0] ?? ''
  );
}

/** The preview draws a resume; a letter (never the output of a tailoring run) draws nothing. */
export function resumeBody(body: DocumentContent | undefined): ResumeContent | null {
  if (!body || body.kind !== 'resume') return null;
  return body;
}

export const siteUrl = (website: string) =>
  /^https?:\/\//.test(website) ? website : `https://${website}`;

/**
 * TAILOR 04–06: a job-first tailoring run (toreview §56), watched and then delivered. While the
 * pipeline runs it is TAILOR 04's checklist; once ready it is TAILOR 05's preview, what changed
 * and Download PDF, which raises TAILOR 06 once the file has been handed off. Applying always
 * happens on the employer's own site (V2 §3), so the last step is a link out.
 */
export function TailorRunView({ generation, run }: TailorRunViewProps) {
  const { spacing, s } = useTheme();
  const actions = useGenerationsActions();
  const resumeId = generation.resumeId ?? '';
  const ready = generation.status === 'ready';

  const job = useJob(generation.jobId ?? '');
  const resume = useResume(resumeId);
  const content = useResumeContent(ready ? resumeId : '');
  const user = useCurrentUser();

  const [saved, setSaved] = useState<TailorSavedFile | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const pages = resume.data?.pageCount;
  const onSaved = useCallback(
    (name: string) => {
      setSaved({ name, meta: savedPagesLabel(pages) });
      setSheetOpen(true);
    },
    [pages],
  );
  const { download, busy, emailBlocked } = useTailorDownload(resumeId, onSaved, setNotice);

  const company = job.data?.company;
  const website = job.data?.companyWebsite;
  const domain = website ? siteHost(website) || undefined : undefined;
  const close = () => actions.closeFlow(generation.jobId);
  const edit = () => {
    if (resumeId) actions.openDocument(resumeId);
  };
  const doc = resumeBody(content.data);
  const name = user.data ? `${user.data.firstName} ${user.data.lastName}`.trim() : '';

  return (
    <>
      <Screen
        scroll
        edges={['top', 'bottom']}
        header={<TailorChrome step={ready ? 'download' : 'fix'} onClose={close} />}
        headerStyle={{ paddingBottom: s(ready ? STEPS_TO_PREVIEW : STEPS_TO_ART) }}
        contentContainerStyle={{ paddingBottom: spacing[8] }}
        footer={
          // The run's two bars cross-fade, like the page above them.
          <Reveal stateKey={ready ? 'ready' : 'writing'}>
            {ready ? (
              <StickyActionBar
                floating
                note={emailBlocked ? EXPORT_BLOCK_MESSAGE.email : undefined}
                // No resend here: sign-in already needs a verified email, and a signed-in user has
                // no screen to enter a sign-up code (toreview §114).
                secondary={{ label: 'Edit', onPress: edit, style: { flexBasis: s(EDIT_W) } }}
                primary={{
                  label: emailBlocked ? 'Try again' : 'Download PDF',
                  icon: 'download',
                  haptic: 'medium',
                  loading: busy,
                  onPress: download,
                }}
              />
            ) : (
              <StickyActionBar
                floating
                // The run keeps going without this screen; the notification says when it lands.
                primary={{
                  label: 'Leave and notify me',
                  icon: 'bell',
                  variant: 'ghost',
                  onPress: close,
                }}
              />
            )}
          </Reveal>
        }
      >
        {/* The finished resume fades in over the progress card instead of cutting to it. */}
        <Reveal stateKey={ready ? 'ready' : 'writing'}>
          {ready ? (
            <>
              <ResumePagePreview content={doc} name={name} score={resume.data?.atsScore} />
              <TailorReady
                run={run}
                company={company}
                domain={domain}
                score={resume.data?.atsScore}
                onSeeAll={edit}
              />
            </>
          ) : (
            <TailorProgress
              generation={generation}
              company={company}
              art={FLOW_ART.tailorWriting}
            />
          )}
        </Reveal>
      </Screen>

      {saved ? (
        <TailorSavedSheet
          open={sheetOpen}
          files={[saved]}
          company={company}
          domain={domain}
          onApply={() => {
            if (website) void openExternalUrl(siteUrl(website));
          }}
          onDone={() => setSheetOpen(false)}
        />
      ) : null}
      {/* Only a failed download raises a notice here; the success is TAILOR 06's sheet. */}
      <Toast
        visible={notice != null}
        message={notice ?? ''}
        tone="error"
        onHide={() => setNotice(null)}
      />
    </>
  );
}
