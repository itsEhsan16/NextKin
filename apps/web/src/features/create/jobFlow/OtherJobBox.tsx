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
import {
  File06,
  Lightbulb02,
  Link01,
  Plus,
  Stars02,
  UploadCloud02,
  iconSize,
} from '@/ui/lineIcons';
import { SegmentedControl, type Segment } from '@/ui/SegmentedControl';
import { textLink } from '@/ui/textLink';

import { PanelHead, panel } from './FlowChrome';

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

type Tab = 'paste' | 'link' | 'file';

const TABS: readonly Segment<Tab>[] = [
  {
    id: 'paste',
    label: 'Paste job description',
    icon: <File06 aria-hidden className={iconSize.sm} />,
  },
  { id: 'link', label: 'Paste job link', icon: <Link01 aria-hidden className={iconSize.sm} /> },
  { id: 'file', label: 'Upload file', icon: <UploadCloud02 aria-hidden className={iconSize.sm} /> },
];

const box =
  'rounded-xl border bg-neutral-50/60 transition-[background-color,border-color,box-shadow] duration-base ease-standard focus-within:border-border-selected focus-within:bg-surface-card focus-within:ring-4 focus-within:ring-brand-100';

/**
 * W-FLOW 01's "Add a new job" (849:289, redesigned in toreview §150): paste the description, paste
 * its link, or upload a file, one tab each, then Analyze job. Writing here picks it over a saved job.
 * While the step reads it (`busy`) the box is held as it is (toreview §131).
 */
export function OtherJobBox({
  value,
  onChange,
  selected,
  problem,
  busy = false,
  onAnalyze,
}: {
  value: OtherJob;
  onChange: (next: OtherJob) => void;
  selected: boolean;
  problem?: string | null;
  busy?: boolean;
  /** Reads the job now, as Continue would. */
  onAnalyze: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<Tab>(value.file ? 'file' : 'paste');

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
  const ready = value.file != null || value.text.trim().length > 0;
  const border = selected || dragging ? 'border-border-brand-strong' : 'border-border-default';
  const typed = value.file ? '' : value.text;

  return (
    <div className={panel}>
      <PanelHead
        icon={<Plus className="size-5" />}
        title="Add a new job"
        subtitle="Don’t see your job? Add it using one of the options below."
      />
      <SegmentedControl
        segments={TABS}
        value={tab}
        onChange={setTab}
        label="How to add the job"
        fill
      />

      {tab === 'paste' && (
        <div className="flex flex-col gap-1.5">
          <div className={cn(box, border, 'flex min-h-44 p-4')}>
            <textarea
              aria-label="Job description or link"
              value={typed}
              maxLength={MAX_JD_CHARS}
              readOnly={busy}
              aria-busy={busy || undefined}
              onChange={(event) => onChange({ text: event.target.value, file: null })}
              placeholder="Paste the full job description here…"
              className="min-h-0 w-full flex-1 resize-none bg-transparent text-prose text-text-primary outline-none placeholder:text-text-tertiary"
            />
          </div>
          <p className="self-end text-body-s font-medium text-text-tertiary">
            {typed.length.toLocaleString('en-US')} / {MAX_JD_CHARS.toLocaleString('en-US')}
          </p>
        </div>
      )}

      {tab === 'link' && (
        <label className={cn(box, border, 'flex items-center gap-2.5 px-4 py-3')}>
          <Link01 aria-hidden className={cn(iconSize.sm, 'text-text-tertiary')} />
          <input
            type="url"
            aria-label="Job link"
            value={typed}
            readOnly={busy}
            onChange={(event) => onChange({ text: event.target.value, file: null })}
            placeholder="https://careers.example.com/jobs/123"
            className="min-w-0 flex-1 bg-transparent text-body-l text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </label>
      )}

      {tab === 'file' && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={cn(
            box,
            border,
            'flex min-h-44 flex-col items-center justify-center gap-2.5 border-dashed p-4 text-center',
            dragging && 'bg-surface-brand',
          )}
        >
          {value.file ? (
            <div className="w-full">
              <PickedFile
                file={value.file}
                reading={busy}
                onRemove={() => onChange(emptyOtherJob)}
              />
            </div>
          ) : (
            <>
              <Button
                variant="secondary"
                disabled={busy}
                icon={<UploadCloud02 aria-hidden className={cn(iconSize.sm, 'text-text-brand')} />}
                onClick={() => fileInput.current?.click()}
              >
                Upload a file
              </Button>
              <span className="text-body-s font-medium text-text-tertiary">
                or drop one here · PDF, DOC or DOCX
              </span>
            </>
          )}
        </div>
      )}
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
        <p className="flex flex-wrap items-center gap-1.5 text-body-m text-text-tertiary">
          <Lightbulb02 aria-hidden className={iconSize.sm} />
          <span>
            <span className="font-semibold text-text-secondary">Tip:</span> Include the complete job
            description for better suggestions.
          </span>
          {!ready && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setTab('paste');
                onChange({ text: SAMPLE_JD, file: null });
              }}
              className={textLink}
            >
              Try a sample job
            </button>
          )}
        </p>
      )}

      <button
        type="button"
        disabled={!ready || busy}
        onClick={onAnalyze}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border-brand-strong bg-brand-50 text-body-l font-semibold text-text-brand transition-colors duration-press ease-standard hover:bg-brand-100 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <Stars02 aria-hidden className={iconSize.sm} />
        {busy ? 'Reading the job…' : 'Analyze job'}
      </button>
    </div>
  );
}
