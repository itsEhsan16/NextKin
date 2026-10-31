'use client';

import type { JdInput } from '@nextkin/shared/models';
import { useRef, useState, type DragEvent } from 'react';

import { looksLikeLink } from '@/features/upload/components/JobInput';
import { PickedFile } from '@/features/upload/components/PickedFile';
import {
  FILE_ACCEPT,
  fileProblem,
  linkProblem,
  MAX_JD_CHARS,
  SAMPLE_JD,
} from '@/features/upload/uploadLibrary';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { ProfilePaperPlaneIllustration } from '@/ui/illustrations';
import { Lightbulb02, UploadCloud02, iconSize } from '@/ui/lineIcons';
import { textLink } from '@/ui/textLink';

import { ColumnHead } from './FlowChrome';

export type OtherJob = { text: string; file: File | null };
export const emptyOtherJob: OtherJob = { text: '', file: null };

/** What step 1 can read from the box, or why not yet; `null` while it is empty. */
export function otherJobInput(job: OtherJob): { input: JdInput } | { problem: string } | null {
  if (job.file) {
    const { file } = job;
    return {
      input: {
        source: 'file',
        file: {
          name: file.name,
          uri: URL.createObjectURL(file),
          size: file.size,
          ...(file.type ? { mimeType: file.type } : {}),
        },
        details: { savedToJobs: true },
      },
    };
  }
  const text = job.text.trim();
  if (!text) return null;
  if (looksLikeLink(text)) {
    const why = linkProblem(text);
    return why ? { problem: why } : { input: { source: 'link', url: text } };
  }
  return { input: { source: 'paste', text: job.text } };
}

/**
 * W-FLOW 01's right column (849:289): a job from anywhere — paste the description or its link, or
 * upload or drop a file on the box. Typing here picks it over a saved job; it is read when the
 * step continues. "No job handy?" fills in a sample. While the step reads it (`busy`) the box is
 * held as it is: no typing, picking or dropping over the text being read (toreview §131).
 */
export function OtherJobBox({
  value,
  onChange,
  selected,
  problem,
  busy = false,
}: {
  value: OtherJob;
  onChange: (next: OtherJob) => void;
  selected: boolean;
  problem?: string | null;
  busy?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (file: File) => {
    if (busy) return;
    const why = fileProblem(file);
    setFileError(why);
    if (!why) onChange({ text: '', file });
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) pick(dropped);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3.5">
      <ColumnHead
        art={<ProfilePaperPlaneIllustration className="h-auto w-11" />}
        title="Use another job"
        subtitle="From LinkedIn, a careers page or anywhere else."
      />
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn(
          'flex min-h-60 flex-1 flex-col gap-3 rounded-xl border bg-neutral-50/60 p-4 transition-[background-color,border-color,box-shadow] duration-base ease-standard focus-within:border-border-selected focus-within:bg-surface-card focus-within:ring-4 focus-within:ring-brand-100',
          selected || dragging ? 'border-border-brand-strong' : 'border-border-default',
          dragging && 'bg-surface-brand',
        )}
      >
        {value.file ? (
          <div className="flex-1">
            <PickedFile file={value.file} reading={busy} onRemove={() => onChange(emptyOtherJob)} />
          </div>
        ) : (
          <textarea
            aria-label="Job description or link"
            value={value.text}
            maxLength={MAX_JD_CHARS}
            readOnly={busy}
            aria-busy={busy || undefined}
            onChange={(event) => onChange({ text: event.target.value, file: null })}
            placeholder="Paste the job description, or a link to the posting…"
            className="min-h-0 w-full flex-1 resize-none bg-transparent text-prose text-text-primary outline-none placeholder:text-text-tertiary"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            icon={<UploadCloud02 aria-hidden className={cn(iconSize.sm, 'text-text-brand')} />}
            onClick={() => fileInput.current?.click()}
          >
            Upload a file
          </Button>
          <span className="text-body-s font-medium text-text-tertiary">
            or drop one here · PDF or DOCX
          </span>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Job description file"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next) pick(next);
          event.target.value = '';
        }}
      />
      {(fileError ?? problem) ? (
        <p role="alert" className="text-body-m text-danger-600">
          {fileError ?? problem}
        </p>
      ) : (
        !value.text &&
        !value.file && (
          <p className="flex items-center gap-1.5 text-body-m font-medium text-text-tertiary">
            <Lightbulb02 aria-hidden className={iconSize.sm} />
            No job handy?
            <button
              type="button"
              disabled={busy}
              onClick={() => onChange({ text: SAMPLE_JD, file: null })}
              className={textLink}
            >
              Try a sample job
            </button>
          </p>
        )
      )}
    </div>
  );
}
