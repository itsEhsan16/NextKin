'use client';

import { sectionHeading, type ResumeDocument } from '@nextkin/shared/models';
import { queryPhase, useResume } from '@nextkin/shared/queries';
import { useState } from 'react';

import { DownloadPrompts } from '@/features/resumes/components/DownloadPrompts';
import { cn } from '@/lib/cn';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { showToast } from '@/lib/toast';
import { pageColumn } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { EditorForm } from '../components/EditorForm';
import {
  ConflictBanner,
  NoticeBanner,
  ProblemsDialog,
  RestoreBanner,
} from '../components/EditorNotices';
import { EditorTopBar } from '../components/EditorTopBar';
import { TemplatePicker } from '../components/TemplatePicker';
import { PreviewPane } from '../preview/PreviewPane';
import { documentText } from '../editorText';
import { useEditorActions } from '../useEditorActions';
import { useResumeEditor } from '../useResumeEditor';

/**
 * The resume editor (toreview §124). Form on the left, the page on the right, both the height of
 * the window on a laptop so neither pushes the other off screen; on a phone or a narrow window,
 * Edit and Preview are two tabs. EDIT 01 (866:9), its download checklist EDIT 02 (867:2) and its
 * banners EDIT 03 (867:321).
 */

const copyEdits = (doc: ResumeDocument) =>
  navigator.clipboard
    .writeText(documentText(doc))
    .then(() =>
      showToast('Your edits are copied. Load the latest, then paste back what you need.', {
        tone: 'success',
      }),
    )
    .catch(() =>
      showToast('We couldn’t copy them. Select the text and copy it.', { tone: 'error' }),
    );

const WORKSPACE = 'lg:h-[calc(100dvh-4rem-7.25rem)]';

export function ResumeEditorScreen({ id }: { id: string }) {
  const editor = useResumeEditor(id);
  const resume = useResume(id);
  const actions = useEditorActions(id, editor);
  const [pane, setPane] = useState<'edit' | 'preview'>('edit');
  const [resolving, setResolving] = useState(false);
  const doc = editor.doc;
  const phase = queryPhase(editor.query);

  if (phase === 'error' || (!doc && editor.query.isError)) {
    const missing = (editor.query.error as { status?: number } | null)?.status === 404;
    return (
      <div className={cn(pageColumn, 'flex min-h-[60vh] items-center justify-center')}>
        <StateView
          tone={missing ? 'neutral' : 'danger'}
          title={missing ? 'This resume isn’t here' : 'We couldn’t open this resume'}
          message={
            missing
              ? 'It may have been deleted, or it is a cover letter, which opens from Resumes.'
              : 'Check your connection and try again. Nothing you saved is lost.'
          }
          {...(missing
            ? { actionLabel: 'Back to Resumes', actionHref: '/resumes' as const }
            : { actionLabel: 'Try again', onAction: () => void editor.query.refetch() })}
        />
      </div>
    );
  }

  if (!doc) {
    return (
      <div
        className={cn(pageColumn, 'flex flex-col gap-4 py-5')}
        aria-busy="true"
        aria-label="Opening your resume"
      >
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[70vh] rounded-lg" />
          <Skeleton className="hidden h-[70vh] rounded-lg lg:block" />
        </div>
      </div>
    );
  }

  const resolve = (run: () => Promise<void>) => {
    setResolving(true);
    run()
      .catch(() =>
        showToast('That didn’t go through. Check your connection and try again.', {
          tone: 'error',
        }),
      )
      .finally(() => setResolving(false));
  };

  return (
    <div className={cn(pageColumn, 'flex flex-col gap-3 py-4')}>
      <EditorTopBar
        resumeId={id}
        title={resume.data?.title ?? 'Resume'}
        status={editor.status}
        savedAt={editor.savedAt}
        onRetry={() => void editor.saveNow()}
        problems={actions.problems.length}
        onShowProblems={() => actions.setChecking(true)}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        template={doc.template}
        onDownload={() => void actions.startDownload()}
        downloading={actions.downloading}
      />

      {editor.restorable && (
        <RestoreBanner
          backup={editor.restorable}
          onRestore={editor.restore}
          onDiscard={editor.discardBackup}
        />
      )}
      {editor.status === 'conflict' && (
        <ConflictBanner
          busy={resolving}
          onReload={() => resolve(editor.reloadLatest)}
          onCopy={() => copyEdits(doc)}
        />
      )}
      {(editor.status === 'retrying' || editor.status === 'failed') && editor.message && (
        <NoticeBanner message={editor.message} />
      )}
      {actions.download.blocked && <NoticeBanner message={actions.download.blocked} />}

      <SegmentedControl
        label="Editor view"
        value={pane}
        onChange={setPane}
        fill
        className="lg:hidden"
        segments={[
          { id: 'edit', label: 'Edit' },
          { id: 'preview', label: 'Preview' },
        ]}
      />

      <div className={cn('grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]', WORKSPACE)}>
        <div
          className={cn(
            'min-h-0 lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin]',
            pane === 'edit' ? 'block' : 'hidden lg:block',
          )}
        >
          <EditorForm doc={doc} change={editor.change} problems={actions.problems} />
          <p className="px-1 pb-2 pt-4 text-caption-m text-text-tertiary">
            Saves as you type. Ctrl+Z undoes, Ctrl+S saves now.
          </p>
        </div>
        <PreviewPane
          doc={doc}
          saving={editor.status !== 'saved'}
          toolbar={
            <TemplatePicker
              value={doc.template}
              onChange={(template) => editor.change((d) => ({ ...d, template }), null)}
            />
          }
          className={cn('min-h-[70vh] lg:min-h-0', pane === 'preview' ? 'flex' : 'hidden lg:flex')}
        />
      </div>

      <ProblemsDialog
        open={actions.checking}
        problems={actions.problems}
        headingOf={(section) => (section === 'header' ? 'Header' : sectionHeading(doc, section))}
        onClose={() => actions.setChecking(false)}
      />
      <DownloadPrompts download={actions.download} />
    </div>
  );
}
