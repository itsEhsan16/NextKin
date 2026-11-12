'use client';

import type { DocumentContent, Resume } from '@nextkin/shared/models';
import { useCurrentUser, useResumeContent, useResumePreview } from '@nextkin/shared/queries';

import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { PageImages } from './PageImages';
import { ResumeSheet } from './ResumeSheet';

const isBlank = (body: DocumentContent): boolean =>
  body.kind === 'cover_letter'
    ? body.paragraphs.length === 0
    : !body.summary &&
      [body.skills, body.experience, body.projects, body.education, body.certifications].every(
        (list) => list.length === 0,
      );

/**
 * The Preview tab (304:3313): the typeset pages when the server has them (toreview §111), else the
 * document's own body drawn from the structured model (the mock, a first typeset still running, a
 * failed one).
 */
export function ResumePreviewTab({ resume }: { resume: Resume }) {
  const content = useResumeContent(resume.id);
  const user = useCurrentUser();
  const preview = useResumePreview(resume.id, resume.currentVersionId);

  const typeset = preview.data?.pages.length ? preview.data : undefined;
  if (typeset)
    return (
      <PageImages
        pages={typeset.pages}
        stale={typeset.stale}
        title={resume.title}
        className="rounded-md bg-surface-subtle p-5"
      />
    );

  if (content.isPending) {
    return (
      <div className="flex flex-col gap-2.5 rounded-md bg-surface-subtle p-5">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // Data first: past the skeleton, only a load with nothing to show is an error. A failed
  // background refresh keeps what is on screen (`toreview.md` §84).
  if (content.data === undefined) {
    return (
      <StateView
        tone="danger"
        title="Couldn't load the preview"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void content.refetch()}
        className="py-8"
      />
    );
  }

  const body = content.data;
  if (isBlank(body)) {
    return (
      <StateView
        title="Nothing written yet"
        message="This resume is empty. Its preview fills in as you write it."
        className="py-8"
      />
    );
  }

  // Every web document is a resume; a letter reads as its paragraphs until one is drawn.
  if (body.kind === 'cover_letter') {
    return (
      <div className="flex flex-col gap-2 rounded-md bg-surface-subtle p-5 text-body-s text-text-secondary">
        <p>{body.greeting}</p>
        {body.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p className="whitespace-pre-line">{body.signoff}</p>
      </div>
    );
  }

  const name = user.data ? `${user.data.firstName} ${user.data.lastName}` : '';
  // The page on a muted tile, as the typeset pages above sit: one card, the sheet drawn as paper.
  return (
    <div className="rounded-md bg-surface-subtle p-4">
      {/* The typeset pages aren't ready, so this is the content drawn in the app's own type; the
          download is typeset in the resume's template (redesign R6b, audit RS-30). */}
      <p className="mb-3 text-caption-m text-text-tertiary">
        Quick preview. The PDF you download is typeset in your resume’s template.
      </p>
      <ResumeSheet
        name={name}
        body={body}
        className="rounded-sm border-0 bg-surface-card px-6 pb-6 pt-6 shadow-card"
      />
    </div>
  );
}
