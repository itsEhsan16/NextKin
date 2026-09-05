import { useCallback, useState } from 'react';

import {
  PlanLockedError,
  useExportResume,
  type ExportFormat,
  type ResumeExport,
} from '@/data/queries';
import { renderPdf, shareFile, writeTextFile, type WrittenFile } from '@/lib';

import { useResumesStore, type ResumeSurface } from '../resumesStore';
import { useResumesActions } from './useResumesActions';

/** Said once the file exists and the OS sheet has taken it (V2 §7.12). */
export const EXPORT_SAVED_PDF = 'Saved as PDF';
export const EXPORT_SAVED_TEXT = 'Saved as text';
/** DOCX has no on-device renderer in Expo Go; the reader is told what they actually got. */
export const EXPORT_DOCX_AS_TEXT = "DOCX isn't ready on mobile yet — saved as plain text.";
/** Printing or writing the file failed — the export itself succeeded, so this is retryable. */
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

/**
 * Turns V2 §7.12's export into a file on the device.
 *
 * The repo hands back RENDER INPUTS, never a file: the data layer must not touch a native module,
 * and the real API will return a presigned URL through the same shape. So the writing happens
 * here — `renderPdf` for PDF, `writeTextFile` for the text renditions — and the OS share sheet
 * takes it from the cache directory.
 *
 * Every failure degrades to a toast rather than throwing: an export is one tap deep, and a red
 * screen (or a silent no-op) is a worse answer than a sentence saying what went wrong. The sheet
 * stays open on a failure so the retry is the same tap again; it closes only on success.
 */
export function useDocumentExport(id: string, surface: ResumeSurface = 'tabs') {
  const exportDoc = useExportResume(id);
  const showToast = useResumesStore((state) => state.showToast);
  const closeExport = useResumesStore((state) => state.closeExport);
  const { openUpgrade } = useResumesActions();
  // The format in flight, tracked here rather than read off the mutation: the file is written
  // AFTER the mutation resolves, and the row must stay busy for that half too.
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null);

  const deliver = useCallback(
    async (result: ResumeExport) => {
      const asPdf = result.format === 'pdf';
      // DOCX cannot be rendered on device in Expo Go. A .docx that is really plain text is a file
      // the recipient's Word refuses, so ship the honest thing instead: the text rendition under
      // a .txt name, and say so in the confirmation.
      const fileName =
        result.format === 'docx' ? withExtension(result.fileName, '.txt') : result.fileName;

      const written: WrittenFile | null = asPdf
        ? await renderPdf(result.html, fileName)
        : await writeTextFile(fileName, result.text);
      if (!written) {
        showToast(EXPORT_BUILD_FAILED, surface);
        return;
      }

      const shared = await shareFile(written.uri, {
        mimeType: asPdf ? result.mimeType : TEXT_MIME,
        dialogTitle: `Save ${written.name}`,
      });
      if (shared === 'unavailable') {
        showToast(EXPORT_SHARE_UNAVAILABLE, surface);
        return;
      }

      closeExport();
      if (result.format === 'docx') showToast(EXPORT_DOCX_AS_TEXT, surface);
      else showToast(asPdf ? EXPORT_SAVED_PDF : EXPORT_SAVED_TEXT, surface);
    },
    [closeExport, showToast, surface],
  );

  const run = useCallback(
    (format: ExportFormat) => {
      // An empty id disables the whole hook, the way the query hooks disable on one; and a second
      // tap while a render is in flight must not start a second file.
      if (id.length === 0 || busyFormat != null) return;
      setBusyFormat(format);
      exportDoc.mutate(format, {
        onSuccess: (result) => {
          void deliver(result).finally(() => setBusyFormat(null));
        },
        onError: (error) => {
          setBusyFormat(null);
          // §13.5: the gate is shown before the tap, so a plan lock reaching here means a locked
          // control was bypassed. The answer is the upgrade route, not an error.
          if (error instanceof PlanLockedError) {
            closeExport();
            openUpgrade();
            return;
          }
          showToast(EXPORT_FAILED, surface);
        },
      });
    },
    [busyFormat, closeExport, deliver, exportDoc, id, openUpgrade, showToast, surface],
  );

  return { run, busyFormat };
}
