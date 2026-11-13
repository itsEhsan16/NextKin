'use client';

import { useRenameResume } from '@nextkin/shared/queries';
import type { Route } from 'next';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';
import { Spinner } from '@/ui/Spinner';
import { showToast } from '@/lib/toast';
import { LayersIcon } from '@/ui/icons';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  Edit03,
  File06,
} from '@/ui/lineIcons';

import type { SaveStatus } from '../useAutosave';
import { toolButton, toolIcon } from './controls';
import { SaveIndicator } from './SaveIndicator';

/**
 * The editor's identity block (EDIT 01, 866:158; EDIT 04 for a letter): the way back, the
 * document's tile, its name with a visible rename, and one line of status pills — where the save
 * stands, whether it can be downloaded yet (a click lists what is left), and what the document is
 * for: the job a tailored copy or a letter was written for (a link to it), or "Base resume"
 * (redesign R6c, audit ED-03; the template pill it replaces repeated the preview's own switch,
 * ED-32). Guessed details the download waits on get their own pill, which goes to them (ED-06).
 */

/** What the document is for, in the last pill. */
export type EditorContext =
  | { kind: 'job'; label: string; href?: Route }
  | { kind: 'base' }
  | { kind: 'plain'; label: string };

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
        className="h-control-md w-full min-w-0 max-w-form rounded-md border border-border-brand-strong bg-surface-card px-2.5 text-h1 font-semibold text-text-primary outline-none ring-4 ring-brand-100"
      />
    );
  return (
    <div className="group/name flex min-w-0 items-center gap-1">
      {/* The heading is text; a click on it is a pointer shortcut, and the rename button beside
          it is the control (redesign R6c, audit ED-12). */}
      <h1
        onClick={() => setEditing(true)}
        className="min-w-0 cursor-text truncate rounded-md text-h1 font-semibold text-text-primary decoration-border-brand decoration-dashed underline-offset-4 hover:underline"
      >
        {rename.isPending ? rename.variables.title : title}
      </h1>
      {/* The new name shows at once; the ring says it is still being saved (toreview §131). */}
      {rename.isPending && <Spinner className="text-text-tertiary" />}
      <button
        type="button"
        aria-label={`Rename ${noun.toLowerCase()}`}
        title="Rename"
        onClick={() => setEditing(true)}
        className={toolButton}
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
  guessed = false,
  onCheckGuesses,
  context,
  back = { href: '/resumes' as Route, label: 'Resumes' },
  icon = <File06 className="size-5" />,
  noun = 'Resume',
}: {
  resumeId: string;
  title: string;
  status: SaveStatus;
  savedAt: Date | null;
  onRetry: () => void;
  problems?: number;
  onShowProblems?: () => void;
  /** Some details were guessed and wait on the user's check before a download. */
  guessed?: boolean;
  onCheckGuesses?: () => void;
  context?: EditorContext;
  back?: { href: Route; label: string };
  icon?: ReactNode;
  noun?: string;
}) {
  return (
    <div className="flex min-w-64 flex-1 items-center gap-4">
      <Link
        href={back.href}
        className={cn(buttonClass({ variant: 'secondary', size: 'md' }), 'shrink-0 px-3.5')}
      >
        <ArrowRight aria-hidden className="size-4 rotate-180 text-text-secondary" />
        {back.label}
      </Link>
      <span
        aria-hidden
        className="hidden size-11 shrink-0 items-center justify-center rounded-lg bg-surface-brand-strong text-text-brand sm:flex"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Name id={resumeId} title={title} noun={noun} />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SaveIndicator status={status} savedAt={savedAt} onRetry={onRetry} />
          {onShowProblems &&
            (guessed && problems === 0 && onCheckGuesses ? (
              <button
                type="button"
                onClick={onCheckGuesses}
                className={cn(
                  pill,
                  'bg-warning-50 text-warning-text transition-colors duration-press ease-standard hover:brightness-95 focus-visible:outline-2 focus-visible:outline-brand-600',
                )}
              >
                <AlertTriangle aria-hidden className="size-4.5" />
                Check guessed details
              </button>
            ) : problems > 0 ? (
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
          {context?.kind === 'base' && (
            <span className={cn(pill, 'bg-surface-brand-strong text-text-brand')}>
              <LayersIcon aria-hidden className="size-3" />
              Base resume
            </span>
          )}
          {context?.kind === 'job' &&
            (context.href ? (
              <Link
                href={context.href}
                className={cn(
                  pill,
                  'bg-surface-muted font-medium text-text-secondary transition-colors duration-press ease-standard hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-600',
                )}
              >
                {context.label}
                <ArrowUpRight aria-hidden className="size-3.5" />
              </Link>
            ) : (
              <span className={cn(pill, 'bg-surface-muted font-medium text-text-secondary')}>
                {context.label}
              </span>
            ))}
          {context?.kind === 'plain' && (
            <span className={cn(pill, 'bg-surface-muted font-medium text-text-secondary')}>
              {context.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
