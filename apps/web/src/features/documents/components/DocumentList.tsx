import type { CareerDocument } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';

import type { DocumentView } from '../documentLibrary';
import { DocumentRow } from './DocumentRow';

export type DocumentListProps = {
  documents: CareerDocument[];
  status: 'pending' | 'error' | 'success';
  /** Whether the library holds anything at all, before the pill and the search narrow it. */
  hasAny: boolean;
  view: DocumentView;
  selectedId?: string;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onReset: () => void;
};

/** The list, 12px between rows, or a two-up grid; `DocumentsScreen` puts it in the one scroller. */
export function DocumentList({
  documents,
  status,
  hasAny,
  view,
  selectedId,
  onSelect,
  onRetry,
  onReset,
}: DocumentListProps) {
  // Whatever replaces the skeleton fades in; a list already cached on arrival shows at once.
  const reveal = useReveal(status !== 'pending');

  if (status === 'pending') {
    return (
      <ul className="flex flex-col gap-4">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index}>
            <Skeleton className="h-[106px] rounded-lg" />
          </li>
        ))}
      </ul>
    );
  }

  if (status === 'error') {
    return (
      <StateView
        className={reveal ? 'animate-reveal' : undefined}
        tone="danger"
        title="Couldn't load your documents"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={onRetry}
      />
    );
  }

  if (!hasAny) {
    return (
      <StateView
        className={reveal ? 'animate-reveal' : undefined}
        title="No documents yet"
        message="Uploading certificates and ID proofs is coming soon. Letters you write are in Resumes."
      />
    );
  }

  if (documents.length === 0) {
    return (
      <StateView
        className={reveal ? 'animate-reveal' : undefined}
        title="No documents match"
        message="Try another group, or clear the search."
        actionLabel="Clear search"
        onAction={onReset}
      />
    );
  }

  return (
    <ul
      aria-label="Documents"
      className={cn(
        view === 'grid' ? 'grid grid-cols-2 gap-4' : 'flex flex-col gap-4',
        reveal && 'animate-rise',
      )}
    >
      {documents.map((document) => (
        <li key={document.id}>
          <DocumentRow
            document={document}
            view={view}
            selected={document.id === selectedId}
            onSelect={() => onSelect(document.id)}
          />
        </li>
      ))}
    </ul>
  );
}
