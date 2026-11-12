'use client';

import { resumeEditorHref } from '../resumeHref';
import type { useConfirmedDownload } from '../useConfirmedDownload';
import { AccuracyPrompt } from './AccuracyPrompt';
import { VerifyEmailDialog } from './VerifyEmailDialog';

/** The dialogs a download can stop on: the accuracy check (SYS 02) and verify email (SYS 03). */
export function DownloadPrompts({
  download,
  added,
}: {
  download: ReturnType<typeof useConfirmedDownload>;
  added?: readonly string[];
}) {
  return (
    <>
      <AccuracyPrompt
        open={download.asking}
        onAnswer={download.answer}
        editHref={resumeEditorHref(download.id)}
        {...(added ? { added } : {})}
      />
      <VerifyEmailDialog
        open={download.verifying}
        onClose={download.closeVerify}
        onRetry={() => download.start()}
      />
    </>
  );
}
