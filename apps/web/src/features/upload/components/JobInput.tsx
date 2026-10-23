'use client';

import { isConsentRequired } from '@nextkin/shared/queries';
import { useId, useRef, useState, type DragEvent, type FormEvent } from 'react';

import { USES_BACKEND } from '@/lib/dataSource';
import { cn } from '@/lib/cn';
import { Callout } from '@/ui/Callout';
import { CollapseFade } from '@/ui/CollapseFade';
import { textLink } from '@/ui/textLink';

import { FILE_ACCEPT, fileProblem, linkProblem, MAX_JD_CHARS, SAMPLE_JD } from '../uploadLibrary';
import { useAnalyzeAndOpen, type AnalyzeIntent } from '../useAnalyzeAndOpen';
import { AnalyzeButton, AnalyzeStatus } from './AnalyzeParts';
import { PickedFile } from './PickedFile';

/** A single link pasted on its own: read as a link, not as a description. */
export const looksLikeLink = (text: string) => /^https?:\/\/\S+$/i.test(text.trim());

/**
 * Pages are read by link only where the app can (toreview §114): the mock's stand-in reader in a
 * demo. Against the server, a link is not read yet (D-17, the link reader is still to come), so
 * the box asks for the posting's text instead of showing a made-up description.
 */
export const READS_LINKS = !USES_BACKEND;

/**
 * Add a job (toreview §114, owner 2026-10-19): one box for the description or its link, a file
 * dropped on it or picked from "upload a file", and Analyze, which opens the tailoring screen
 * for it straight away. It replaces the three tabs (247:2, 244:467, 247:453) by the owner's call.
 */
export function JobInput({ intent = 'tailor' }: { intent?: AnalyzeIntent }) {
  const { extract, analyze, busy } = useAnalyzeAndOpen(intent);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const countId = useId();

  const trimmed = text.trim();
  const isLink = !file && looksLikeLink(trimmed);
  const linkBlocked = isLink && (!READS_LINKS || linkProblem(trimmed) !== null);
  const ready = file != null || (trimmed.length > 0 && !linkBlocked);
  // A consent refusal is the dialog's to handle: it carries the request on once agreed (§114).
  const status = busy
    ? 'pending'
    : extract.isError && !isConsentRequired(extract.error)
      ? 'error'
      : 'idle';

  const pick = (next: File) => {
    if (busy) return;
    const why = fileProblem(next);
    setProblem(why);
    if (!why) setFile(next);
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) pick(dropped);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    if (file) {
      analyze({
        source: 'file',
        file: {
          name: file.name,
          uri: URL.createObjectURL(file),
          size: file.size,
          ...(file.type ? { mimeType: file.type } : {}),
        },
        details: { savedToJobs: true },
      });
    } else if (isLink) {
      analyze({ source: 'link', url: trimmed });
    } else {
      analyze({ source: 'paste', text });
    }
  };

  return (
    <form onSubmit={submit} aria-labelledby={headingId} className="flex flex-col">
      <h2 id={headingId} className="text-h2 font-bold text-text-primary">
        Paste the job description or its link
      </h2>
      <p className="mt-1 text-body-m text-text-secondary">
        {intent === 'build'
          ? 'We read it, then write a new resume for it from your profile.'
          : 'We read it, compare it with your resume and take you straight to tailoring.'}
      </p>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn(
          'relative mt-5 rounded-xl transition-shadow duration-base ease-standard',
          dragging && 'ring-4 ring-brand-100',
        )}
      >
        <textarea
          aria-label="Job description or link"
          aria-describedby={countId}
          value={text}
          disabled={file != null}
          readOnly={busy}
          aria-busy={busy || undefined}
          maxLength={MAX_JD_CHARS}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste the complete job description, or a link to the posting…"
          className="block min-h-64 w-full resize-none rounded-xl border border-border-default bg-neutral-50/60 p-5 pb-10 text-body-l text-text-primary transition-[background-color,border-color,box-shadow] duration-base ease-standard outline-none placeholder:text-text-tertiary hover:border-border-brand-strong focus-visible:border-border-selected focus-visible:bg-surface-card focus-visible:ring-4 focus-visible:ring-brand-100 disabled:opacity-50"
        />
        <span
          id={countId}
          className="pointer-events-none absolute bottom-3.5 right-4 text-caption-m tabular-nums text-text-tertiary"
        >
          {text.length.toLocaleString('en-US')}/{MAX_JD_CHARS.toLocaleString('en-US')}
        </span>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-s text-text-tertiary">
        <span>
          Or{' '}
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className={textLink}
          >
            upload a file
          </button>{' '}
          (PDF, DOCX or TXT, up to 5 MB), or drop it on the box.
        </span>
        {!text && !file && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setText(SAMPLE_JD)}
            className={textLink}
          >
            Try a sample job
          </button>
        )}
      </p>
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

      {problem && (
        <CollapseFade axis="vertical" open animateMount>
          <p role="alert" className="mt-2 text-body-s text-danger-600">
            {problem}
          </p>
        </CollapseFade>
      )}
      {file && (
        <CollapseFade axis="vertical" open animateMount>
          <div className="mt-3">
            <PickedFile
              file={file}
              reading={busy}
              onRemove={() => {
                setFile(null);
                extract.reset();
              }}
            />
          </div>
        </CollapseFade>
      )}
      {isLink && linkBlocked && (
        <Callout tone="warning" className="mt-3">
          {READS_LINKS
            ? linkProblem(trimmed)
            : 'Links can’t be read yet. Paste the description, or save the page as a PDF and upload it.'}
        </Callout>
      )}
      {!isLink && !file && (
        <Callout className="mt-4">
          Paste the whole posting, requirements and nice-to-haves included, for the best match.
        </Callout>
      )}

      <AnalyzeStatus status={status} error={extract.error} className="mt-3" />

      <div className="mt-6 flex justify-end">
        <AnalyzeButton
          label={
            isLink
              ? 'Read the posting'
              : intent === 'build'
                ? 'Continue'
                : file
                  ? 'Upload & tailor my resume'
                  : 'Tailor my resume'
          }
          sparkle
          pending={busy}
          disabled={!ready}
        />
      </div>
    </form>
  );
}
