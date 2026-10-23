import type { CareerDocument, CareerDocumentKind } from '@nextkin/shared/models';
import type { Route } from 'next';
import Link from 'next/link';

import { ChevronRightIcon } from '@/ui/icons';

import { documentMeta } from '../documentLibrary';
import { FileTypeTile } from './FileTypeTile';
import { pressable } from '@/ui/pressable';
import { cn } from '@/lib/cn';
import { cardPad, cardSurface } from '@/ui/Card';

/** "Other cover letters" (580:249), in the plural of each kind. */
const OTHER_TITLE: Record<CareerDocumentKind, string> = {
  certificate: 'Other certificates',
  cover_letter: 'Other cover letters',
  id_proof: 'Other ID proofs',
  resume: 'Other resumes',
  other: 'Other documents',
};

/** How many the card lists; "View all" opens the library for the rest. */
const LIMIT = 3;

/**
 * "Other cover letters" (580:244): the library's other files of the same kind, newest first, each
 * opening in this viewer. Nothing when it has none.
 */
export function OtherDocumentsCard({
  document,
  documents,
}: {
  document: CareerDocument;
  documents: readonly CareerDocument[];
}) {
  const others = documents
    .filter((other) => other.kind === document.kind && other.id !== document.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, LIMIT);
  if (others.length === 0) return null;

  return (
    <section aria-labelledby="other-documents" className={cn(cardSurface, cardPad)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="other-documents" className="text-title-l font-semibold text-text-primary">
          {OTHER_TITLE[document.kind]}
        </h2>
        <Link
          href="/documents"
          className="rounded-sm text-body-s font-semibold text-text-brand transition-opacity duration-press ease-standard hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          View all
        </Link>
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {others.map((other) => (
          <li key={other.id}>
            <Link
              href={`/documents/${other.id}` as Route}
              className={cn(
                pressable,
                '-mx-3 flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              )}
            >
              <FileTypeTile format={other.format} size="row" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-l font-medium text-text-primary">
                  {other.title}
                </span>
                <span className="block truncate text-body-s text-text-tertiary">
                  {documentMeta(other)}
                </span>
              </span>
              <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-text-tertiary" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
