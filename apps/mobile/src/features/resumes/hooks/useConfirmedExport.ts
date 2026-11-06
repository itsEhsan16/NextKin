import { useCallback } from 'react';

import {
  ExportBlockedError,
  useConfirmAccuracy,
  useExportResume,
  type ExportFormat,
  type ResumeExport,
} from '@/data/queries';
import { downloadFile, renderPdf, writeTextFile, type WrittenFile } from '@/lib';

import { useAccuracyStore } from '../accuracyStore';

/** The user answered "not yet" to the accuracy confirmation: no file, and nothing went wrong. */
export class ExportCancelledError extends Error {
  constructor() {
    super('The export was cancelled before confirming the version.');
    this.name = 'ExportCancelledError';
  }
}

/**
 * An export that asks for the accuracy confirmation when the repo says the version needs one
 * (`ExportBlockedError`, reason `accuracy`), records it, and tries once more. The other blocks
 * (an open Zero Resume review, an unverified email) and every other failure reach the caller.
 */
export function useConfirmedExport(id: string) {
  const exportDoc = useExportResume(id);
  const confirm = useConfirmAccuracy(id);
  const ask = useAccuracyStore((state) => state.ask);
  return useCallback(
    async (format: ExportFormat): Promise<ResumeExport> => {
      try {
        return await exportDoc.mutateAsync(format);
      } catch (error) {
        if (!(error instanceof ExportBlockedError) || error.reason !== 'accuracy') throw error;
        if (!(await ask())) throw new ExportCancelledError();
        await confirm.mutateAsync();
        return exportDoc.mutateAsync(format);
      }
    },
    [ask, confirm, exportDoc],
  );
}

/**
 * The export as a file in the cache directory. A backend export is downloaded from its presigned
 * URL as rendered; a mock export is printed (PDF) or written (text) on the device, where DOCX has
 * no renderer and goes out as its text rendition under a .txt name. `asText` says so.
 */
export async function materialize(
  result: ResumeExport,
  fileName: string,
): Promise<{ file: WrittenFile | null; asText: boolean }> {
  if (result.delivery === 'file')
    return { file: await downloadFile(result.url, fileName), asText: false };
  if (result.format === 'pdf')
    return { file: await renderPdf(result.html, fileName), asText: false };
  return { file: await writeTextFile(fileName, result.text), asText: true };
}
