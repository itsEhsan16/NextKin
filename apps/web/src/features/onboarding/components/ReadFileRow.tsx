import { cn } from '@/lib/cn';
import { CheckCircleIcon, DocumentIcon, PdfIcon } from '@/ui/icons';
import { ProgressBar } from '@/ui/ProgressBar';

import { isPdfName } from '../resumeUpload';

export type ReadState =
  | { status: 'reading' }
  | { status: 'read'; summary: string }
  | { status: 'failed'; message: string };

/**
 * The picked resume under the drop zone (814:381): its type tile, its name, a bar, and what
 * reading it found, with a green tick once read. While it reads, the bar breathes and Continue
 * waits. A failure says why in red, and the drop zone above takes another file.
 */
export function ReadFileRow({ name, state }: { name: string; state: ReadState }) {
  const pdf = isPdfName(name);
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-border-default bg-surface-card py-3 pl-3 pr-4 animate-reveal">
      <span
        aria-hidden
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg',
          pdf ? 'bg-danger-50 text-danger-600' : 'bg-tile-blue text-tile-blue-ink',
        )}
      >
        {pdf ? <PdfIcon className="size-[18px]" /> : <DocumentIcon className="size-[18px]" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="truncate text-body-l font-semibold text-text-primary">{name}</p>
        {state.status === 'read' ? (
          <ProgressBar value={1} label="Resume read" sweep className="h-1.5" />
        ) : (
          <div
            aria-hidden
            className={cn(
              'h-1.5 w-full rounded-full',
              state.status === 'reading' ? 'animate-pulse bg-brand-100' : 'bg-danger-50',
            )}
          />
        )}
        <p
          role={state.status === 'failed' ? 'alert' : 'status'}
          className={cn(
            'text-body-s font-medium',
            state.status === 'failed' ? 'text-danger-text' : 'text-text-tertiary',
          )}
        >
          {state.status === 'reading'
            ? 'Reading your resume…'
            : state.status === 'read'
              ? state.summary
              : state.message}
        </p>
      </div>
      {state.status === 'read' && (
        <CheckCircleIcon
          aria-hidden={false}
          role="img"
          aria-label="Read"
          className="size-5 shrink-0 text-success-600"
        />
      )}
    </div>
  );
}
