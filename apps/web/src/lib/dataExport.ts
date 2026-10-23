import type { DataExportStatus } from '@nextkin/shared/models';

import { formatShortDate } from '@/lib/format';

/**
 * Where the data export (V2 §8.5) has got to, in a sentence. The Account page's Security tab and
 * Settings → Privacy & data both say it this way; `idle` is each one's own line for before an
 * archive has been asked for.
 */
export function exportLine(status: DataExportStatus | undefined, idle: string): string {
  switch (status?.status) {
    case 'preparing':
      return 'Preparing your archive…';
    case 'ready':
      return `${status.fileName ?? 'Your archive'} · ${status.sizeLabel ?? ''} is ready${
        status.expiresAt ? ` until ${formatShortDate(status.expiresAt)}` : ''
      }.`;
    case 'failed':
      return status.error ?? 'The archive failed to build. Try again.';
    default:
      return idle;
  }
}
