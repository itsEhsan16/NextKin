'use client';

import { cn } from '@/lib/cn';
import { buttonClass } from '@/ui/Button';
import { HistoryIcon, RedoIcon, UndoIcon } from '@/ui/icons';
import { Download01 } from '@/ui/lineIcons';
import { StableLabel } from '@/ui/StableLabel';

import type { SaveStatus } from '../useAutosave';
import { useModKey } from '../useModKey';
import { EditorIdentity, type EditorContext } from './EditorIdentity';

/**
 * The editor's page header (EDIT 01, 866:157): the document's identity and status
 * (`EditorIdentity`), then History, undo, redo and Download PDF. The template switch sits on the
 * preview; duplicating and deleting are on the resume's menu in Resumes. Shortcuts are said in
 * the buttons' own tooltips, with the platform's key (redesign R6c, audit ED-15).
 */

/** Undo and redo: 40 px round outline buttons, quiet ink until hovered. */
const control = cn(
  buttonClass({ variant: 'secondary', size: 'md', pill: true }),
  'w-control-md shrink-0 px-0 text-text-secondary hover:text-text-primary',
);

export function EditorTopBar(props: {
  resumeId: string;
  title: string;
  status: SaveStatus;
  savedAt: Date | null;
  onRetry: () => void;
  problems: number;
  onShowProblems: () => void;
  guessed: boolean;
  onCheckGuesses: () => void;
  context?: EditorContext;
  onShowHistory: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const mod = useModKey();
  const undo = `Undo (${mod}+Z)`;
  const redo = `Redo (${mod}+Shift+Z)`;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <EditorIdentity
        resumeId={props.resumeId}
        title={props.title}
        status={props.status}
        savedAt={props.savedAt}
        onRetry={props.onRetry}
        problems={props.problems}
        onShowProblems={props.onShowProblems}
        guessed={props.guessed}
        onCheckGuesses={props.onCheckGuesses}
        {...(props.context ? { context: props.context } : {})}
      />

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Version history"
          title="Version history"
          aria-haspopup="dialog"
          onClick={props.onShowHistory}
          className={control}
        >
          <HistoryIcon aria-hidden className="size-4.5" />
        </button>
        <button
          type="button"
          aria-label={undo}
          title={undo}
          disabled={!props.canUndo}
          onClick={props.onUndo}
          className={control}
        >
          <UndoIcon aria-hidden className="size-4.5" />
        </button>
        <button
          type="button"
          aria-label={redo}
          title={redo}
          disabled={!props.canRedo}
          onClick={props.onRedo}
          className={control}
        >
          <RedoIcon aria-hidden className="size-4.5" />
        </button>
        <button
          type="button"
          onClick={props.onDownload}
          disabled={props.downloading}
          title={`Download PDF · ${mod}+S saves first`}
          className={cn(buttonClass({ size: 'md' }), 'ml-2')}
        >
          <Download01 aria-hidden className="size-4" />
          <StableLabel label="Download PDF" busyLabel="Preparing PDF…" busy={props.downloading} />
        </button>
      </div>
    </div>
  );
}
