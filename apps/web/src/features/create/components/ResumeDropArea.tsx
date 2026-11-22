'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';

import { useResumeUpload } from '@/features/create/jobFlow/useResumeUpload';
import { RESUME_INPUT_ACCEPT } from '@/features/onboarding/resumeUpload';
import { cn } from '@/lib/cn';
import { File06, UploadCloud02 } from '@/ui/lineIcons';
import { textLink } from '@/ui/textLink';
import { useProgressFill, type ProgressPhase } from '@/ui/useProgressFill';

const UPLOAD_STAGES = ['Uploading…', 'Reading your resume…', 'Almost there…'] as const;

/** "PDF" or "DOCX", from the name, for the line under it. */
const fileKind = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toUpperCase() ?? 'FILE';

/**
 * The one place a resume file is dropped or picked (owner, toreview §221; every upload since
 * §257, where six zones drew six). A file is read the moment it lands, with no Upload button.
 * While a file is over the zone, or being read, its border becomes a turning brand gradient and
 * the zone lifts a little. The read shows the file, a fill and honest stages (`useProgressFill`,
 * the same as Continue's). At 100% `onUploaded` hands over the saved resume; a failure drains,
 * says why and offers another file.
 */
export function ResumeDropArea({
  onUploaded,
  onBusyChange,
  className,
}: {
  onUploaded: (upload: { resumeId: string; name: string }) => void;
  /** Whether a file is being read: a popup holds its × and Escape meanwhile. */
  onBusyChange?: (busy: boolean) => void;
  /** The zone's own height or width where its column needs it (`min-h-56`). */
  className?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [readId, setReadId] = useState<string | null>(null);
  const upload = useResumeUpload(setReadId);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Nothing reports how far the read has got, so the fill is the honest timed one.
  const phase: ProgressPhase = readId
    ? 'done'
    : upload.reading
      ? 'working'
      : upload.error
        ? 'failed'
        : 'idle';
  const { fillRef, stage, busy } = useProgressFill<HTMLSpanElement>({
    phase,
    stages: UPLOAD_STAGES,
    onFilled: () => {
      if (readId) onUploaded({ resumeId: readId, name: file?.name ?? 'your resume' });
    },
  });
  const active = dragging || busy;

  const busyChange = useRef(onBusyChange);
  useEffect(() => {
    busyChange.current = onBusyChange;
  });
  useEffect(() => {
    busyChange.current?.(busy);
  }, [busy]);

  const pick = (picked: File) => {
    if (busy) return;
    setFile(picked);
    upload.pick(picked);
  };
  const browse = () => {
    if (!busy) input.current?.click();
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {/* The ring: a turning gradient that fades in behind a 2px gap while active. */}
      <div
        className={cn(
          'relative rounded-xl p-0.5 transition-[translate,box-shadow] duration-base ease-standard',
          active && '-translate-y-0.5 shadow-card motion-reduce:translate-y-0',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'gradient-ring absolute inset-0 rounded-xl transition-opacity duration-base ease-standard',
            active ? 'animate-ring-flow opacity-100' : 'opacity-0',
          )}
        />
        <div
          role="button"
          tabIndex={busy ? -1 : 0}
          aria-disabled={busy || undefined}
          aria-busy={busy || undefined}
          aria-label={
            busy
              ? `Reading ${file?.name ?? 'your resume'}`
              : 'Upload a resume: drop it here, or press to browse files'
          }
          onClick={browse}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              browse();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={(event) => {
            // Moving between the zone's own children isn't leaving it.
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setDragging(false);
          }}
          onDrop={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files[0];
            if (dropped) pick(dropped);
          }}
          className={cn(
            'relative flex min-h-44 flex-col items-center justify-center gap-2 rounded-lg border px-6 py-6 text-center transition-colors duration-base ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
            active
              ? 'border-transparent bg-surface-card'
              : 'cursor-pointer border-dashed border-border-brand-strong bg-surface-brand hover:bg-brand-50',
            className,
          )}
        >
          {busy && file ? (
            <div className="flex w-full max-w-md flex-col gap-3">
              <div className="flex items-center gap-3 text-left">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-brand text-text-brand"
                >
                  <File06 className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    title={file.name}
                    className="block truncate text-body-m font-semibold text-text-primary"
                  >
                    {file.name}
                  </span>
                  <span className="block text-body-s text-text-tertiary">
                    {fileKind(file.name)}
                  </span>
                </span>
              </div>
              {/* The fill: a brand gradient with a sheen and a swaying edge, like Continue's. */}
              <span className="relative h-2.5 overflow-hidden rounded-full bg-brand-100">
                <span
                  ref={fillRef}
                  data-testid="upload-fill"
                  style={{ translate: '-100% 0' }}
                  className="absolute inset-0 rounded-full bg-linear-to-r from-brand-400 to-brand-600"
                >
                  <span className="absolute inset-y-0 left-0 w-1/3 animate-sweep bg-linear-to-r from-transparent via-neutral-0/30 to-transparent motion-reduce:hidden" />
                  <span className="absolute -right-1 -top-1/2 h-[200%] w-2.5 animate-liquid-edge rounded-full bg-brand-300/70 blur-[2px] motion-reduce:hidden" />
                </span>
              </span>
              <span className="inline-grid text-left text-body-m font-medium text-text-secondary">
                {UPLOAD_STAGES.map((label) => (
                  <span
                    key={label}
                    aria-hidden
                    className={cn(
                      'col-start-1 row-start-1 transition-opacity duration-fast ease-standard',
                      label !== stage && 'opacity-0',
                    )}
                  >
                    {label}
                  </span>
                ))}
              </span>
            </div>
          ) : (
            <>
              <UploadCloud02
                aria-hidden
                className={cn(
                  'size-8 text-text-brand transition-transform duration-base ease-standard',
                  dragging && '-translate-y-1 motion-reduce:translate-y-0',
                )}
              />
              <p className="text-body-l font-medium text-text-primary">
                {dragging ? (
                  'Drop to upload'
                ) : (
                  <>
                    Drop your resume here, or{' '}
                    <span className={cn(textLink, 'font-semibold underline')}>browse files</span>
                  </>
                )}
              </p>
              <p className="text-body-s font-medium text-text-tertiary">PDF or DOCX</p>
            </>
          )}
        </div>
      </div>

      {/* Room for a failure kept under the zone, so nothing jumps when one shows. */}
      <div className="min-h-6">
        {!busy && upload.error ? (
          <p
            role="alert"
            className="flex flex-wrap items-center gap-x-2 text-body-m text-danger-600"
          >
            <span>{upload.error}</span>
            <button type="button" onClick={browse} className={cn(textLink, 'font-semibold')}>
              Try another file
            </button>
          </p>
        ) : null}
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {busy ? stage : ''}
      </span>
      <input
        ref={input}
        type="file"
        accept={RESUME_INPUT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Resume file"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          if (picked) pick(picked);
          event.target.value = '';
        }}
      />
    </div>
  );
}
