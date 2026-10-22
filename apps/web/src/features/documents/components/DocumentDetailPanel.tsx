import type { CareerDocument } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { AiCallout } from '@/ui/AiCallout';
import { brandButton } from '@/ui/brandButton';
import {
  DownloadIcon,
  EllipsisIcon,
  LinkIcon,
  MoreVerticalIcon,
  OpenInNewIcon,
  SendIcon,
} from '@/ui/icons';
import { outlineButton } from '@/ui/outlineButton';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import { documentMeta } from '../documentLibrary';
import { DocumentPreview } from './DocumentPreview';
import { FileTypeTile } from './FileTypeTile';
import { useLetterJob } from '../useLetterJob';
import { cardSurface } from '@/ui/Card';
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
  'h-control-lg flex-1 gap-2 whitespace-nowrap rounded-md px-2 text-body-l font-semibold';

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

  return (
    <div className={cn('min-h-0 overflow-y-auto [scrollbar-width:thin]', className)}>
      {status === 'empty' && (
        <div className={cn(CARD, 'p-5')}>
          {hasAny ? (
            <StateView
              title="Select a document"
              message="Choose one from the list to preview it."
            />
          ) : (
            <StateView
              title="Nothing to preview yet"
              message="Upload a document and its preview will show here."
            />
          )}
        </div>
      )}

      {/* As tall as the card and callout that replace it (`toreview.md` §84). */}
      {status === 'pending' && (
        <>
          <div className={cn(CARD, 'flex flex-col gap-3 p-4')}>
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-md" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="mt-1 h-control-lg w-full rounded-md" />
            <Skeleton className="h-96 w-full" />
          </div>
          <Skeleton className="mt-3 h-16 rounded-lg" />
        </>
      )}

      {(status === 'error' || (status === 'success' && !document)) && (
        <div className={cn(CARD, 'p-5')}>
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
          {/* 286:2294. Attaching happens where you apply: the letter's own job, or the jobs. */}
          <div className="mt-3">
            <AiCallout
              title="Use this document in your applications"
              message="Attach this document directly when applying to jobs."
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
      className={cn(CARD, 'p-4', reveal && '*:animate-reveal')}
    >
      <div className="flex items-center gap-3">
        <FileTypeTile format={document.format} size="card" />
        <div className="min-w-0 flex-1">
          <h2 className="text-h2 text-neutral-800">{document.title}</h2>
          <p className="mt-0.5 text-body-m text-text-tertiary">{documentMeta(document)}</p>
        </div>
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            aria-label="More options"
            className={cn(
              '-mr-1 flex size-6 shrink-0 items-center justify-center self-start rounded-sm text-text-tertiary transition-colors duration-press ease-standard hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              soonControl,
            )}
          >
            <MoreVerticalIcon className="size-4" />
          </button>
        </Soon>
      </div>

      <div className="mt-4 flex gap-3">
        <Link href={`/documents/${document.id}` as Route} className={cn(brandButton, ACTION)}>
          Open
          <OpenInNewIcon className="size-4 shrink-0" />
        </Link>
        <Soon>
          <button aria-disabled="true" type="button" className={cn(outlineButton, ACTION)}>
            <DownloadIcon className="size-4 shrink-0 text-text-secondary" />
            Download
          </button>
        </Soon>
        <Soon>
          <button aria-disabled="true" type="button" className={cn(outlineButton, ACTION)}>
            <LinkIcon className="size-4 shrink-0 text-text-secondary" />
            Share
          </button>
        </Soon>
        <Soon>
          <button
            aria-disabled="true"
            type="button"
            aria-label="More actions"
            className={cn(soonControl, outlineButton, 'h-control-lg w-12 shrink-0 rounded-md')}
          >
            <EllipsisIcon className="size-4 text-text-secondary" />
          </button>
        </Soon>
      </div>

      <div className="mt-4">
        <DocumentPreview document={document} />
      </div>
    </section>
  );
}
