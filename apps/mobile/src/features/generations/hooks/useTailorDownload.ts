import { useCallback, useState } from 'react';

import type { ExportReceipt } from '@/data/models';
import { EXPORT_BLOCK_MESSAGE, ExportBlockedError, type ResumeExport } from '@/data/queries';
import { ExportCancelledError, materialize, useConfirmedExport } from '@/features/resumes';
import { shareFile } from '@/lib';

import { markExported } from './sessionExports';

/** The same sentences the editor's export says (useDocumentExport), for the same failures. */
export const TAILOR_DOWNLOAD_FAILED = 'The download failed. Check your connection and try again.';
export const TAILOR_BUILD_FAILED = "We couldn't build that file. Try again.";
export const TAILOR_SHARE_UNAVAILABLE = "This device can't share files right now.";

/**
 * TAILOR 05's one-tap "Download PDF" (toreview §56.2: PDF only; other formats stay in the
 * editor's export). The file is downloaded (backend) or printed (mock) and handed to the OS share
 * sheet, exactly as the editor's export does, after the same accuracy confirmation. `onSaved` gets
 * the written file's name so TAILOR 06 can show it; `onError` gets a sentence to toast.
 */
export function useTailorDownload(
  resumeId: string,
  onSaved: (fileName: string, receipt?: ExportReceipt) => void,
  onError: (message: string) => void,
) {
  const exportDoc = useConfirmedExport(resumeId);
  const [busy, setBusy] = useState(false);
  // An unverified address is not a failure to toast: the bar says so in place, with a resend
  // and the retry (toreview §114).
  const [emailBlocked, setEmailBlocked] = useState(false);

  const download = useCallback(() => {
    if (resumeId.length === 0 || busy) return;
    setBusy(true);
    setEmailBlocked(false);
    void (async () => {
      let result: ResumeExport;
      try {
        result = await exportDoc('pdf');
      } catch (error) {
        if (error instanceof ExportCancelledError) return;
        if (error instanceof ExportBlockedError && error.reason === 'email') {
          setEmailBlocked(true);
          return;
        }
        onError(
          error instanceof ExportBlockedError
            ? EXPORT_BLOCK_MESSAGE[error.reason]
            : TAILOR_DOWNLOAD_FAILED,
        );
        return;
      }
      const { file } = await materialize(result, result.fileName);
      if (!file) return onError(TAILOR_BUILD_FAILED);
      const shared = await shareFile(file.uri, {
        mimeType: result.mimeType,
        dialogTitle: `Save ${file.name}`,
      });
      if (shared === 'unavailable') return onError(TAILOR_SHARE_UNAVAILABLE);
      markExported(resumeId, file.name);
      onSaved(file.name, result.delivery === 'file' ? result.receipt : undefined);
    })().finally(() => setBusy(false));
  }, [busy, exportDoc, onError, onSaved, resumeId]);

  return { download, busy, emailBlocked };
}
