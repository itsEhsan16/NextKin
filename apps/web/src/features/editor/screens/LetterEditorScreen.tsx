'use client';

import type { CoverLetterContent } from '@nextkin/shared/models';
import { useCurrentUser, useProfile, useResume, useResumeContent } from '@nextkin/shared/queries';
import type { Route } from 'next';

import { DownloadPrompts } from '@/features/resumes/components/DownloadPrompts';
import { useConfirmedDownload } from '@/features/resumes/useConfirmedDownload';
import { primaryButton } from '@/features/create/jobFlow/FlowChrome';
import { jobHref } from '@/features/jobs/jobHref';
import { cn } from '@/lib/cn';
import { cardSurface } from '@/ui/Card';
import { RedoIcon, UndoIcon } from '@/ui/icons';
import { Download01, Mail01 } from '@/ui/lineIcons';
import { pageColumn } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StableLabel } from '@/ui/StableLabel';
import { StateView } from '@/ui/StateView';

import { toolButton } from '../components/controls';
import { EditorIdentity } from '../components/EditorIdentity';
import { LetterForm } from '../components/LetterForm';
import { LetterPreview } from '../preview/LetterPreview';
import { useLetterDraft } from '../useLetterDraft';

/**
 * A cover letter's editor (EDIT 04, 867:636): the way back to Documents, the letter's name and
 * the job it is for, undo, redo and Download PDF; the form on the left and the letter as it prints
 * on the right. Download is the same export, with its accuracy confirmation.
 */

const control = cn(toolButton, 'border border-border-default bg-surface-card');

export function LetterEditorScreen({ id }: { id: string }) {
  const content = useResumeContent(id);
  const resume = useResume(id);
  const user = useCurrentUser();
  const profile = useProfile();
  const download = useConfirmedDownload(id);
  const letter =
    content.data?.kind === 'cover_letter' ? (content.data as CoverLetterContent) : null;
  const draft = useLetterDraft(id, letter);
  const shown = draft.shown;

  if (content.isError || (content.data && !letter)) {
    return (
      <div className={cn(pageColumn, 'flex min-h-[60vh] items-center justify-center')}>
        <StateView
          tone="danger"
          title="We couldn’t open this letter"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void content.refetch()}
        />
      </div>
    );
  }
  if (!shown) {
    return (
      <div className={cn(pageColumn, 'flex flex-col gap-4 py-5')} aria-busy="true">
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[60vh] rounded-xl" />
          <Skeleton className="hidden h-[60vh] rounded-xl lg:block" />
        </div>
      </div>
    );
  }

  const r = resume.data;
  const job = [r?.targetRole, r?.targetCompany].filter(Boolean).join(' · ');
  const unsaved = draft.status === 'unsaved' || draft.status === 'failed';
  return (
    <div className={cn(pageColumn, 'flex flex-col gap-4 py-4')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <EditorIdentity
          resumeId={id}
          title={r?.title ?? 'Cover letter'}
          status={draft.status}
          savedAt={draft.savedAt}
          onRetry={() => draft.save(shown)}
          // Letters are Resume records and list in Resumes, not Documents (redesign R6c,
          // audit ED-44).
          back={{ href: '/resumes' as Route, label: 'Resumes' }}
          icon={<Mail01 className="size-5" />}
          noun="Letter"
          // The job it was written for, as a link to it (redesign R6c, audit ED-50).
          {...(job
            ? {
                context: {
                  kind: 'job' as const,
                  label: `For ${job}`,
                  ...(r?.linkedJobId ? { href: jobHref(r.linkedJobId) } : {}),
                },
              }
            : {})}
        />
        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Undo"
            disabled={!draft.canUndo}
            onClick={draft.undo}
            className={control}
          >
            <UndoIcon aria-hidden className="size-4.5" />
          </button>
          <button
            type="button"
            aria-label="Redo"
            disabled={!draft.canRedo}
            onClick={draft.redo}
            className={control}
          >
            <RedoIcon aria-hidden className="size-4.5" />
          </button>
          <button
            type="button"
            disabled={download.busy || draft.status === 'saving'}
            onClick={() => (unsaved ? draft.save(shown) : download.start())}
            className={primaryButton}
          >
            <Download01 aria-hidden className="size-4" />
            <StableLabel
              label={unsaved ? 'Save, then download' : 'Download PDF'}
              busyLabel="Preparing PDF…"
              busy={download.busy}
            />
          </button>
        </div>
      </div>
      {download.blocked && (
        <p
          role="status"
          className="rounded-xl border border-warning-text/30 bg-warning-50 px-4 py-3 text-body-m text-warning-text"
        >
          {download.blocked}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className={cn(cardSurface, 'rounded-xl p-5 shadow-card')}>
          <LetterForm draft={shown} onEdit={draft.edit} />
        </div>
        <LetterPreview
          id={id}
          versionId={r?.currentVersionId}
          name={user.data ? `${user.data.firstName} ${user.data.lastName}`.trim() : ''}
          contact={[profile.data?.location, user.data?.email].filter(Boolean).join(' · ')}
          draft={shown}
        />
      </div>
      <DownloadPrompts download={download} />
    </div>
  );
}
