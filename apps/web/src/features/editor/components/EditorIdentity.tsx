'use client';

import { RESUME_TEMPLATES, type ResumeTemplateId } from '@nextkin/shared/models';
import { useRenameResume } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Spinner } from '@/ui/Spinner';
import { showToast } from '@/lib/toast';
import { LayersIcon } from '@/ui/icons';
import { AlertTriangle, ArrowRight, CheckCircle, Edit03, File06 } from '@/ui/lineIcons';

import type { SaveStatus } from '../useAutosave';
import { toolButton, toolIcon } from './controls';
import { SaveIndicator } from './SaveIndicator';

/**
 * The editor's identity block (EDIT 01, 866:158; EDIT 04 for a letter): the way back, the
 * document's tile, its name with a visible rename, and one line of status pills — where the save
 * stands, whether it can be downloaded yet (a click lists what is left), and its template, or for
 * a letter the job it was written for.
 */

const pill =
  'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-caption-m font-semibold';

function Name({ id, title, noun }: { id: string; title: string; noun: string }) {
  const rename = useRenameResume();
  const [editing, setEditing] = useState(false);
  const commit = (value: string) => {
    setEditing(false);
    const next = value.trim();
    if (!next || next === title) return;
    rename.mutate(
      { id, title: next.slice(0, 200) },
      { onError: () => showToast('We couldn’t rename it. Try again.', { tone: 'error' }) },
    );
  };

  if (editing)
    return (
      <input
        autoFocus
        aria-label={`${noun} name`}
        defaultValue={title}
        maxLength={200}
        onFocus={(event) => event.target.select()}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          if (event.key === 'Escape') setEditing(false);
        }}
        className="h-9 w-full min-w-0 max-w-[420px] rounded-md border border-border-brand-strong bg-surface-card px-2 text-h2 font-bold text-text-primary outline-none ring-4 ring-brand-100"
      />
    );
  return (
    <div className="group/name flex min-w-0 items-center gap-1">
      <h1 className="min-w-0 truncate text-h2 font-bold text-text-primary">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="max-w-full truncate rounded-md text-left decoration-border-brand decoration-dashed underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {rename.isPending ? rename.variables.title : title}
        </button>
      </h1>
      {/* The new name shows at once; the ring says it is still being saved (toreview §131). */}
      {rename.isPending && <Spinner className="text-text-tertiary" />}
      <button
        type="button"
        aria-label={`Rename ${noun.toLowerCase()}`}
        title="Rename"
        onClick={() => setEditing(true)}
        className={cn(toolButton, 'size-8')}
      >
        <Edit03 aria-hidden className={cn(toolIcon, 'size-4')} />
      </button>
    </div>
  );
}

export function EditorIdentity({
  resumeId,
  title,
  status,
  savedAt,
  onRetry,
  problems = 0,
  onShowProblems,
  template,
  back = { href: '/resumes' as Route, label: 'Resumes' },
  icon = <File06 className="size-5" />,
  noun = 'Resume',
  tag,
}: {
  resumeId: string;
  title: string;
  status: SaveStatus;
  savedAt: Date | null;
  onRetry: () => void;
  problems?: number;
  onShowProblems?: () => void;
  template?: ResumeTemplateId;
  back?: { href: Route; label: string };
  icon?: ReactNode;
  noun?: string;
  /** The last pill: a letter's job, in place of a resume's template. */
  tag?: string;
}) {
  const templateName = RESUME_TEMPLATES.find((t) => t.id === template)?.name ?? 'Classic';
  const last = tag ?? (template ? `${templateName} template` : null);
  return (
    <div className="flex min-w-[16rem] flex-1 items-center gap-3.5">
      <Link
        href={back.href}
        className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-border-default bg-surface-card px-3 text-body-m font-semibold text-text-primary shadow-sm transition-colors duration-press ease-standard hover:border-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <ArrowRight aria-hidden className="size-4.5 rotate-180" />
        {back.label}
      </Link>
      <span
        aria-hidden
        className="hidden size-11 shrink-0 items-center justify-center rounded-lg bg-surface-brand-strong text-text-brand sm:flex"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Name id={resumeId} title={title} noun={noun} />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SaveIndicator status={status} savedAt={savedAt} onRetry={onRetry} />
          {onShowProblems &&
            (problems > 0 ? (
              <button
                type="button"
                onClick={onShowProblems}
                className={cn(
                  pill,
                  'bg-warning-50 text-warning-text transition-colors duration-press ease-standard hover:brightness-95 focus-visible:outline-2 focus-visible:outline-brand-600',
                )}
              >
                <AlertTriangle aria-hidden className="size-4.5" />
                {problems === 1 ? '1 thing to finish' : `${problems} things to finish`}
              </button>
            ) : (
              <span className={cn(pill, 'bg-success-surface text-success-text')}>
                <CheckCircle aria-hidden className="size-4.5" />
                Ready to download
              </span>
            ))}
          {last && (
            <span className={cn(pill, 'bg-neutral-100 font-medium text-text-secondary')}>
              <LayersIcon aria-hidden className="size-3" />
              {last}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
