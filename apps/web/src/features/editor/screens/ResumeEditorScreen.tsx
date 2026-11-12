'use client';

import { sectionHeading, type ResumeDocument } from '@nextkin/shared/models';
import { queryPhase, useResume, useResumes } from '@nextkin/shared/queries';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

import { jobHref } from '@/features/jobs/jobHref';
import { DownloadPrompts } from '@/features/resumes/components/DownloadPrompts';
import { ResumeVersionsTab } from '@/features/resumes/components/ResumeVersionsTab';
import { resumeHref } from '@/features/resumes/resumeHref';
import { cn } from '@/lib/cn';
import { Callout } from '@/ui/Callout';
import { Drawer } from '@/ui/Drawer';
import { textLink } from '@/ui/textLink';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { showToast } from '@/lib/toast';
import { pageColumn } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { anchorOf, EditorForm } from '../components/EditorForm';
import type { EditorContext } from '../components/EditorIdentity';
import {
  ConflictBanner,
  NoticeBanner,
  ProblemsDialog,
  RestoreBanner,
} from '../components/EditorNotices';
import { EditorTopBar } from '../components/EditorTopBar';
import { TemplatePicker } from '../components/TemplatePicker';
import { PreviewPane } from '../preview/PreviewPane';
import { reveal } from '../reveal';
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

const WORKSPACE = 'lg:h-[calc(100dvh-4rem-8.75rem)]';

/** The first entry Zero Resume Mode guessed, which a download waits on (V2 §7.9). */
function firstGuess(doc: ResumeDocument) {
  const role = doc.experience.find((entry) => entry.assumed);
  if (role) return { anchor: anchorOf('experience'), entryId: role.id };
  const school = doc.education.find((entry) => entry.assumed);
  if (school) return { anchor: anchorOf('education'), entryId: school.id };
  return undefined;
}

const noop = () => () => undefined;

const NOTE_KEY = (id: string) => `nextkin:editor-copy-note:${id}`;

/**
 * Base or copy, said where the editing happens (redesign R6c, audit ED-04; Jobright's editor note):
 * a tailored copy's edits stay in the copy, and the base's don't reach copies already made. Shown
 * until dismissed, per resume, in this browser.
 */
function CopyNote({ id, tailored, baseId }: { id: string; tailored: boolean; baseId?: string }) {
  // Read from this browser (none on the server, so the note waits for the client to say).
  const stored = useSyncExternalStore(
    noop,
    () => {
      try {
        return localStorage.getItem(NOTE_KEY(id)) === '1';
      } catch {
        return false;
      }
    },
    () => true,
  );
  const [dismissed, setDismissed] = useState(false);
  if (stored || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(NOTE_KEY(id), '1');
    } catch {
      // Private mode: it shows again next time, which is harmless.
    }
  };
  return (
    <Callout tone="info" className="mb-4">
      <p>
        {tailored
          ? 'Edits here change only this copy. Your base resume stays as it is.'
          : 'Tailored copies already made keep their own text. New ones start from this.'}
      </p>
      <p className="mt-1.5 flex flex-wrap gap-x-4">
        {tailored && baseId && (
          <Link href={resumeHref(baseId)} className={cn(textLink, 'font-semibold')}>
            Open base resume
          </Link>
        )}
        <button type="button" onClick={dismiss} className={cn(textLink, 'font-semibold')}>
          Got it
        </button>
      </p>
    </Callout>
  );
}

export function ResumeEditorScreen({ id }: { id: string }) {
  const editor = useResumeEditor(id);
  const resume = useResume(id);
  const actions = useEditorActions(id, editor);
  const [pane, setPane] = useState<'edit' | 'preview'>('edit');
  const [resolving, setResolving] = useState(false);
  const [history, setHistory] = useState(false);
  const library = useResumes();
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
              ? 'It may have been deleted. Your resumes and letters are in Resumes.'
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

  const r = resume.data;
  const tailored = r?.variant === 'tailored';
  const baseId = library.data?.find((item) => item.isBase && item.id !== id)?.id;
  // What the document is for, in the top bar's last pill (ED-03).
  const context: EditorContext | undefined = r?.isBase
    ? { kind: 'base' }
    : tailored && (r?.targetRole || r?.targetCompany)
      ? {
          kind: 'job',
          label: `Tailored for ${[r.targetRole, r.targetCompany].filter(Boolean).join(' · ')}`,
          ...(r.linkedJobId ? { href: jobHref(r.linkedJobId) } : {}),
        }
      : undefined;
  const guess = firstGuess(doc);

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
    <div className={cn(pageColumn, 'flex flex-col gap-5 py-6')}>
      <EditorTopBar
        resumeId={id}
        title={resume.data?.title ?? 'Resume'}
        status={editor.status}
        savedAt={editor.savedAt}
        onRetry={() => void editor.saveNow()}
        problems={actions.problems.length}
        onShowProblems={() => actions.setChecking(true)}
        guessed={Boolean(doc.pendingReview)}
        onCheckGuesses={() => guess && reveal(guess)}
        {...(context ? { context } : {})}
        onShowHistory={() => setHistory(true)}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
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

      <div
        className={cn(
          'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
          WORKSPACE,
        )}
      >
        <div
          className={cn(
            '-m-1 min-h-0 p-1 lg:overflow-y-auto [scrollbar-width:thin]',
            pane === 'edit' ? 'block' : 'hidden lg:block',
          )}
        >
          {(tailored || r?.isBase) && <CopyNote id={id} tailored={tailored} baseId={baseId} />}
          <EditorForm doc={doc} change={editor.change} problems={actions.problems} />
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
      {/* Who made each version and what it changed (ED-07, V2 §7.11). Restoring is on the
          resume's card in Resumes, where no unsaved typing can be overwritten. */}
      {r && (
        <Drawer open={history} onOpenChange={setHistory} title="Version history" size="sm">
          <div className="flex flex-col gap-4 p-6 pt-16">
            <h2 className="text-h2 font-semibold text-text-primary">Version history</h2>
            <ResumeVersionsTab resume={r} canRestore={false} />
            <p className="text-body-s text-text-tertiary">
              To restore an older version,{' '}
              <Link href={resumeHref(id)} className={textLink}>
                open this resume in Resumes
              </Link>
              .
            </p>
          </div>
        </Drawer>
      )}
    </div>
  );
}
