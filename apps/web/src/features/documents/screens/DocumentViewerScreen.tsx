'use client';

import type { CareerDocument } from '@nextkin/shared/models';
import { queryPhase, useCurrentUser, useDocuments, useProfile } from '@nextkin/shared/queries';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { PageHeader } from '@/navigation/PageHeader';
import { AiCallout } from '@/ui/AiCallout';
import { ChevronRightIcon } from '@/ui/icons';
import { ProfilePaperPlaneIllustration } from '@/ui/illustrations';
import { pageFillMin, pageFrameInBar } from '@/ui/pageFrame';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { CertificateSheet, DocumentPreview } from '../components/DocumentPreview';
import { LetterSheet } from '../components/LetterSheet';
import { OtherDocumentsCard } from '../components/OtherDocumentsCard';
import { ViewerDetailsCard } from '../components/ViewerDetailsCard';
import { documentMeta } from '../documentLibrary';
import { useLetterJob } from '../useLetterJob';

/** The page itself, on the board's grey stage (563:1720). */
function Stage({ document }: { document: CareerDocument }) {
  const user = useCurrentUser();
  const profile = useProfile();

  let page;
  if (document.coverLetter && user.data) {
    page = <LetterSheet letter={document.coverLetter} user={user.data} profile={profile.data} />;
  } else if (document.coverLetter && user.isError) {
    // Without the account the sender's lines can't be set, so the page says so rather than
    // waiting on a skeleton for ever.
    page = (
      <StateView
        tone="danger"
        title="Couldn't load this letter"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void user.refetch()}
      />
    );
  } else if (document.coverLetter) {
    page = <Skeleton className="mx-auto aspect-[540/764] w-full max-w-[540px] rounded-sm" />;
  } else if (document.certificate) {
    page = (
      <div className="mx-auto w-full max-w-[540px] rounded-sm bg-surface-card p-6 shadow-card">
        <CertificateSheet certificate={document.certificate} />
      </div>
    );
  } else {
    page = (
      <div className="mx-auto w-full max-w-[420px]">
        <DocumentPreview document={document} />
      </div>
    );
  }

  return (
    <section
      aria-label="Preview"
      className="rounded-lg border border-border-card bg-surface-card p-5 shadow-card"
    >
      <div className="rounded-md border border-border-faint bg-neutral-50 px-6 py-7">{page}</div>
    </section>
  );
}

const breadcrumb = (
  <Link
    href="/documents"
    className="flex w-fit items-center gap-1.5 rounded-sm transition-colors duration-press ease-standard hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
  >
    Documents
    <ChevronRightIcon aria-hidden className="size-3.5" />
  </Link>
);

/**
 * A document, opened (563:1377), which replaced the viewer's coming-soon page: the page itself on
 * the left, and on the right its details, the way into applying with it, and the others of its
 * kind. The board opens a cover letter; a certificate is drawn as the Documents card draws it, and
 * any other file says it has no preview (`toreview.md` §95).
 */
export function DocumentViewerScreen({ id }: { id: string }) {
  const documents = useDocuments();
  const document = documents.data?.find((candidate) => candidate.id === id);
  const applyHref = useLetterJob(document);
  // Fades in as it loads, and again when "Other cover letters" opens another one here (§102).
  const reveal = useReveal(Boolean(document), id);

  if (queryPhase(documents) === 'error') {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          tone="danger"
          title="Something went wrong"
          message="We couldn't load this document. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void documents.refetch()}
        />
      </div>
    );
  }

  if (documents.data && !document) {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          title="Document not found"
          message="It may have been deleted. Your other documents are in the library."
          actionLabel="Back to Documents"
          actionHref="/documents"
        />
      </div>
    );
  }

  return (
    <div className={cn(pageFrameInBar, 'flex flex-col gap-4 pb-8')}>
      <PageHeader
        eyebrow={breadcrumb}
        title={
          document ? document.title : <Skeleton as="span" className="my-[3px] block h-6 w-72" />
        }
        subtitle={
          document ? (
            documentMeta(document)
          ) : (
            <Skeleton as="span" className="my-0.5 block h-4 w-48" />
          )
        }
      />

      {!document ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <Skeleton className="h-[52rem] rounded-lg" />
          {/* The details card, the callout and Other cover letters. */}
          <div className="flex flex-col gap-4">
            <Skeleton className="h-[34rem] rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-60 rounded-lg" />
          </div>
        </div>
      ) : (
        <div
          key={document.id}
          className={cn(
            'grid items-start gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]',
            reveal && 'animate-reveal',
          )}
        >
          <Stage document={document} />
          <div className="flex min-w-0 flex-col gap-4">
            <ViewerDetailsCard document={document} roleHref={applyHref} />
            {/* 580:230. Attaching happens where you apply: the letter's own job, or the jobs. */}
            <AiCallout
              title="Use this document in your applications"
              message="Attach this document directly when applying to jobs."
              href={applyHref}
              icon={<ProfilePaperPlaneIllustration aria-hidden className="h-auto w-12 shrink-0" />}
            />
            <OtherDocumentsCard document={document} documents={documents.data ?? []} />
          </div>
        </div>
      )}
    </div>
  );
}
