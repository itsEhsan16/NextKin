import type { ResumeExport } from '@nextkin/shared/queries';

import { printDocument } from './printDocument';
import { browserStorageUrl } from './storageUrl';

/**
 * Hands an export to the browser (V2 §7.12, C-07). A backend export is a real file behind a
 * presigned URL that lasts at most 15 minutes; it is downloaded straight away, and the link's
 * `Content-Disposition: attachment` names the file. A mock export is render inputs, which the
 * print dialog turns into a PDF ("Save as PDF"), as before the backend existed.
 */
export function deliverExport(result: ResumeExport, fileName: string = result.fileName): void {
  if (result.delivery === 'render') {
    printDocument(result.html, fileName);
    return;
  }
  const link = document.createElement('a');
  link.href = browserStorageUrl(result.url);
  link.download = fileName;
  link.rel = 'noopener';
  link.className = 'hidden';
  document.body.append(link);
  link.click();
  link.remove();
}
