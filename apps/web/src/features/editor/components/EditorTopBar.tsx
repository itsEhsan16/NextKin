'use client';

import type { ResumeTemplateId } from '@nextkin/shared/models';

import { primaryButton } from '@/features/create/jobFlow/FlowChrome';
import { cn } from '@/lib/cn';
import { RedoIcon, UndoIcon } from '@/ui/icons';
import { Download01 } from '@/ui/lineIcons';
import { StableLabel } from '@/ui/StableLabel';

import type { SaveStatus } from '../useAutosave';
import { toolButton } from './controls';
import { EditorIdentity } from './EditorIdentity';

/**
 * The editor's page header (EDIT 01, 866:157): the document's identity and status
 * (`EditorIdentity`), then undo, redo and Download PDF. The template switch sits on the preview;
 * duplicating and deleting are on the resume's menu in Resumes.
 */

const control = cn(toolButton, 'border border-border-default bg-surface-card');

export function EditorTopBar(props: {
  resumeId: string;
  title: string;
  status: SaveStatus;
  savedAt: Date | null;
  onRetry: () => void;
  problems: number;
  onShowProblems: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  template: ResumeTemplateId;
  onDownload: () => void;
  downloading: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <EditorIdentity
        resumeId={props.resumeId}
        title={props.title}
        status={props.status}
        savedAt={props.savedAt}
        onRetry={props.onRetry}
        problems={props.problems}
        onShowProblems={props.onShowProblems}
        template={props.template}
      />

      <div className="ml-auto flex items-center gap-2.5">
        <button
          type="button"
          aria-label="Undo (Ctrl+Z)"
          title="Undo (Ctrl+Z)"
          disabled={!props.canUndo}
          onClick={props.onUndo}
          className={control}
        >
          <UndoIcon aria-hidden className="size-4.5" />
        </button>
        <button
          type="button"
          aria-label="Redo (Ctrl+Shift+Z)"
          title="Redo (Ctrl+Shift+Z)"
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
          className={primaryButton}
        >
          <Download01 aria-hidden className="size-4" />
          <StableLabel label="Download PDF" busyLabel="Preparing PDF…" busy={props.downloading} />
        </button>
      </div>
    </div>
  );
}
