import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  EXPORT_BLOCK_MESSAGE,
  ExportBlockedError,
  PlanLockedError,
  type ExportFormat,
  type ResumeExport,
  useAskAboutApplication,
} from '@/data/queries';
import { useApplyAskStore } from '@/features/jobs/applyAskStore';
import { shareFile } from '@/lib';

import { useResumesStore, type ResumeSurface } from '../resumesStore';
import { ExportCancelledError, materialize, useConfirmedExport } from './useConfirmedExport';

/** Said once the file exists and the OS sheet has taken it (V2 §7.12). */
export const EXPORT_SAVED_PDF = 'Saved as PDF';
export const EXPORT_SAVED_TEXT = 'Saved as text';
export const EXPORT_SAVED_DOCX = 'Saved as Word (DOCX)';
/** Mock mode only: DOCX has no on-device renderer in Expo Go, so the reader is told what they got. */
export const EXPORT_DOCX_AS_TEXT = "DOCX isn't ready on mobile yet — saved as plain text.";
/** Writing or downloading the file failed — the export itself succeeded, so this is retryable. */
export const EXPORT_BUILD_FAILED = "We couldn't build that file. Try again.";
/** No share sheet on this runtime, so the file exists but nothing can receive it. */
export const EXPORT_SHARE_UNAVAILABLE = "This device can't share files right now.";
/** The export request itself rejected. */
export const EXPORT_FAILED = 'The download failed. Check your connection and try again.';

const TEXT_MIME = 'text/plain';

/**
 * Swaps a rendered file's extension. Pure and exported so the .docx → .txt substitution is
 * checkable without a device.
 */
export function withExtension(fileName: string, extension: string): string {
  const dot = fileName.lastIndexOf('.');
  return `${dot > 0 ? fileName.slice(0, dot) : fileName}${extension}`;
}

const savedSentence = (format: ExportFormat): string =>
  format === 'pdf' ? EXPORT_SAVED_PDF : format === 'docx' ? EXPORT_SAVED_DOCX : EXPORT_SAVED_TEXT;

/**
 * Turns V2 §7.12's export into a file on the device and hands it to the OS share sheet.
 *
 * On the backend the export is a real file behind a presigned URL, downloaded as rendered (PDF,
 * DOCX, TXT). On the mock it is render inputs, printed or written here. Before a version's first
 * export the user confirms it is accurate (V2 §15 risk 2; `useConfirmedExport` asks).
 *
 * Every failure degrades to a toast rather than throwing: an export is one tap deep, and a red
 * screen (or a silent no-op) is a worse answer than a sentence saying what went wrong. The sheet
 * stays open on a failure, or on a "not yet", so the retry is the same tap again; it closes only
 * on success.
 */
export function useDocumentExport(id: string, surface: ResumeSurface = 'tabs') {
  const exportDoc = useConfirmedExport(id);
  const showToast = useResumesStore((state) => state.showToast);
  const closeExport = useResumesStore((state) => state.closeExport);
  const askAbout = useAskAboutApplication();
  const openAsk = useApplyAskStore((state) => state.open);
  // The router directly, not useResumesActions: that hook needs the tabs' create-sheet provider,
  // and the export also runs on pushed screens (the editor, a finished Build run) outside it.
  const router = useRouter();
  // The format in flight, tracked here rather than read off the mutation: the file is written
  // AFTER the export resolves, and the row must stay busy for that half too.
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null);

  const deliver = useCallback(
    async (result: ResumeExport) => {
      // A mock DOCX is really plain text, and a .docx that is plain text is a file Word refuses,
      // so it ships as what it is: the text rendition under a .txt name, said in the confirmation.
      const mockDocx = result.delivery === 'render' && result.format === 'docx';
      const fileName = mockDocx ? withExtension(result.fileName, '.txt') : result.fileName;
      const { file, asText } = await materialize(result, fileName);
      if (!file) {
        showToast(EXPORT_BUILD_FAILED, surface, 'error');
        return;
      }

      const shared = await shareFile(file.uri, {
        mimeType: asText ? TEXT_MIME : result.mimeType,
        dialogTitle: `Save ${file.name}`,
      });
      if (shared === 'unavailable') {
        showToast(EXPORT_SHARE_UNAVAILABLE, surface, 'error');
        return;
      }

      closeExport();
      if (mockDocx) showToast(EXPORT_DOCX_AS_TEXT, surface, 'info');
      else showToast(savedSentence(result.format), surface);
      // A resume made for a job has just left the phone: ask whether it went anywhere.
      askAbout.mutate({ resumeId: id }, { onSuccess: (ask) => ask && openAsk(ask) });
    },
    [askAbout, closeExport, id, openAsk, showToast, surface],
  );

  const run = useCallback(
    (format: ExportFormat) => {
      // An empty id disables the whole hook, the way the query hooks disable on one; and a second
      // tap while a render is in flight must not start a second file.
      if (id.length === 0 || busyFormat != null) return;
      setBusyFormat(format);
      void exportDoc(format)
        .then(deliver)
        .catch((error: unknown) => {
          if (error instanceof ExportCancelledError) return;
          // §13.5: the gate is shown before the tap, so a plan lock reaching here means a locked
          // control was bypassed. The answer is the upgrade route, not an error.
          if (error instanceof PlanLockedError) {
            closeExport();
            router.push('/upgrade');
            return;
          }
          // An open Zero Resume review or an unverified email: say which, in the product's words.
          if (error instanceof ExportBlockedError) {
            showToast(EXPORT_BLOCK_MESSAGE[error.reason], surface, 'info');
            return;
          }
          showToast(EXPORT_FAILED, surface, 'error');
        })
        .finally(() => setBusyFormat(null));
    },
    [busyFormat, closeExport, deliver, exportDoc, id, router, showToast, surface],
  );

  return { run, busyFormat };
}
