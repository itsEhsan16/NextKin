import type { CareerDocument } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { ArrowRight } from '@/ui/lineIcons';
import { useReveal } from '@/lib/useReveal';
import { AiCallout } from '@/ui/AiCallout';
import { brandButton } from '@/ui/brandButton';
import { DownloadIcon, EllipsisIcon, LinkIcon, MoreVerticalIcon, SendIcon } from '@/ui/icons';
import { iconButton } from '@/ui/iconButton';
import { outlineButton } from '@/ui/outlineButton';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { EmptyStateArt } from '@/ui/illustrations';

import { documentMeta } from '../documentLibrary';
import { DocumentPreview } from './DocumentPreview';
import { FileTypeTile } from './FileTypeTile';
import { applyCopy, useLetterJob } from '../useLetterJob';
import { cardSurface, cardSurfaceLoading } from '@/ui/Card';
import { Soon, soonControl } from '@/ui/Soon';

export type DocumentDetailPanelProps = {
  document?: CareerDocument;
  /** `'empty'`: nothing to show — no document picked, or none at all (`hasAny`). */
  status: 'pending' | 'error' | 'success' | 'empty';
  hasAny: boolean;
  onRetry: () => void;
  className?: string;
};

const CARD = cardSurface;
const ACTION =
  'h-control-lg flex-1 gap-2 whitespace-nowrap rounded-md px-3 text-body-l font-semibold';

/**
 * The right column (286:2217): the open document's card and, under it, the way into applying with
 * it. The two scroll together, as one unit, only when the window is shorter than they are
 * (`toreview.md` §16).
 */
export function DocumentDetailPanel({
  document,
  status,
  hasAny,
  onRetry,
  className,
}: DocumentDetailPanelProps) {
  const reveal = useReveal(status === 'success', document?.id);
  const applyHref = useLetterJob(document);
  const apply = document ? applyCopy(document, applyHref) : undefined;

  return (
    <div className={cn('min-h-0 overflow-y-auto scrollbar-thin', className)}>
      {status === 'empty' && (
        <div className={cn(CARD, 'p-6')}>
          {hasAny ? (
            <StateView
              art={<EmptyStateArt object="tablet" />}
              title="Select a document"
              message="Choose one from the list to preview it."
            />
          ) : (
            <StateView
              art={<EmptyStateArt object="tablet" />}
              title="Nothing to preview yet"
              message="When a document is here, its preview shows here."
            />
          )}
        </div>
      )}

      {/* As tall as the card and callout that replace it (`toreview.md` §84). */}
      {status === 'pending' && (
        <>
          <div className={cn(cardSurfaceLoading, 'flex flex-col gap-4 p-6')}>
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-md" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="mt-1 h-control-lg w-full rounded-md" />
            <Skeleton className="h-96 w-full rounded-md" />
          </div>
          <Skeleton className="mt-4 h-16 rounded-lg" />
        </>
      )}

      {(status === 'error' || (status === 'success' && !document)) && (
        <div className={cn(CARD, 'p-6')}>
          <StateView
            tone="danger"
            title="Couldn't load this document"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={onRetry}
          />
        </div>
      )}

      {status === 'success' && document && (
        <>
          <DocumentDetailCard key={document.id} document={document} reveal={reveal} />
          {/* 286:2294, honest about where applying happens (DC-13): not an AI suggestion, so the
              muted tone. */}
          <div className="mt-4">
            <AiCallout
              tone="muted"
              title={apply?.title ?? ''}
              message={apply?.message ?? ''}
              href={applyHref}
              icon={<SendIcon className="size-5 shrink-0 text-brand-600" />}
            />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The open document (286:2218): tile, name and meta line, the four actions, then the document
 * itself. Open goes to the document viewer (563:1377). Download and Share need the file, which the
 * mock doesn't hold, so they say "Coming soon", like the kebabs (`toreview.md` §102).
 */
function DocumentDetailCard({ document, reveal }: { document: CareerDocument; reveal: boolean }) {
  return (
    <section
      aria-label={document.title}
      // The frame stays put; its contents fade in (`toreview.md` §84).
      className={cn(CARD, 'p-6', reveal && '*:animate-reveal')}
    >
      <div className="flex items-center gap-4">
        <FileTypeTile format={document.format} size="card" />
        <div className="min-w-0 flex-1">
          <h2 className="text-h2 text-text-primary">{document.title}</h2>
          <p className="mt-1 text-body-m text-text-tertiary">{documentMeta(document)}</p>
        </div>
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            aria-label="More options"
            className={cn(
              iconButton,
              '-mr-2 -mt-1 self-start text-text-tertiary hover:text-text-primary',
              soonControl,
            )}
          >
            <MoreVerticalIcon className="size-4" />
          </button>
        </Soon>
      </div>

      {/* One row from 1024: below 1280 Download and Share drop their icons, and a narrower card wraps (DC-16). Open stays in this tab, so its arrow says so
          (DC-15); Download and Share read as unavailable, not just say it on hover. */}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <Link href={`/documents/${document.id}` as Route} className={cn(brandButton, ACTION)}>
          Open
          <ArrowRight aria-hidden className="size-4 shrink-0" />
        </Link>
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            className={cn(outlineButton, ACTION, soonControl)}
          >
            <DownloadIcon
              aria-hidden
              className="size-4 shrink-0 text-text-secondary max-xl:hidden"
            />
            Download
          </button>
        </Soon>
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            className={cn(outlineButton, ACTION, soonControl)}
          >
            <LinkIcon aria-hidden className="size-4 shrink-0 text-text-secondary max-xl:hidden" />
            Share
          </button>
        </Soon>
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            aria-label="More actions"
            className={cn(soonControl, outlineButton, 'size-control-lg shrink-0 rounded-full')}
          >
            <EllipsisIcon className="size-4 text-text-secondary" />
          </button>
        </Soon>
      </div>

      <div className="mt-5">
        <DocumentPreview document={document} />
      </div>
    </section>
  );
}
