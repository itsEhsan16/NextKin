import { cn } from '@/lib/cn';
import { formatFileSize } from '@/lib/format';
import { iconButton } from '@/ui/iconButton';
import { JdPdfFileIllustration } from '@/ui/illustrations';
import { CheckCircle, File06, XClose, iconSize } from '@/ui/lineIcons';
import { Spinner } from '@/ui/Spinner';

import { isPdfName } from '../uploadLibrary';

/**
 * The picked file's card (247:580; toreview §131): its type, name and size, where it stands —
 * "Reading…" while it is read, "Ready" once it can be — and a way to take it back. The board draws
 * only a PDF; a DOC, DOCX or TXT shows the document glyph on the indigo tile the Resumes page
 * uses. No remove while it is being read.
 */
export function PickedFile({
  file,
  onRemove,
  reading = false,
}: {
  file: { name: string; size: number };
  onRemove?: () => void;
  reading?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-card bg-surface-card px-3.5 py-3 shadow-raised">
      {isPdfName(file.name) ? (
        <JdPdfFileIllustration className="h-9 w-auto shrink-0" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-tile-indigo text-tile-indigo-ink">
          <File06 aria-hidden className={iconSize.md} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-m font-medium text-text-primary">{file.name}</p>
        <p className="text-body-s text-text-tertiary">{formatFileSize(file.size)}</p>
      </div>
      <span
        role="status"
        className={cn(
          'flex shrink-0 items-center gap-1.5 text-body-m font-semibold',
          reading ? 'text-text-secondary' : 'text-success-600',
        )}
      >
        {reading ? (
          <Spinner className="text-brand-600" />
        ) : (
          <CheckCircle aria-hidden className={iconSize.sm} />
        )}
        {reading ? 'Reading…' : 'Ready'}
      </span>
      {onRemove && !reading && (
        <button
          type="button"
          aria-label={`Remove ${file.name}`}
          onClick={onRemove}
          className={cn(iconButton, 'shrink-0 text-text-tertiary hover:text-text-secondary')}
        >
          <XClose aria-hidden className={iconSize.sm} />
        </button>
      )}
    </div>
  );
}
