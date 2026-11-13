'use client';

import type { Resume } from '@nextkin/shared/models';

import { cn } from '@/lib/cn';
import { useReveal } from '@/lib/useReveal';
import { cardPad, cardSurface, cardSurfaceLoading } from '@/ui/Card';
import { Skeleton } from '@/ui/Skeleton';
import { StateView } from '@/ui/StateView';
import { EmptyStateArt } from '@/ui/illustrations';

import { ResumeDetailCard } from './ResumeDetailCard';

export type ResumeDetailPanelProps = {
  resume?: Resume;
  /** `'empty'`: nothing to show — no document picked, or none at all (`hasAny`). */
  status: 'pending' | 'error' | 'success' | 'empty';
  hasAny: boolean;
  onRetry: () => void;
  onCreate?: () => void;
  /** Opens a copy made from the card's menu, as the row's menu does (RS-60). */
  onSelect?: (id: string) => void;
  className?: string;
};

/**
 * The right column's panel (304:3246): the selected document, as one card. The board also puts
 * the library's search and sort here; the overhaul moved them over the list they narrow
 * (`ResumeSearchBar`), so the panel holds the document and nothing nested in a second frame.
 *
 * Like the other pages' detail cards it keeps its natural height. When the window is shorter, only
 * the open tab scrolls, under the card's header, actions and tabs (redesign R6a, audit RS-22).
 */
export function ResumeDetailPanel({
  resume,
  status,
  hasAny,
  onRetry,
  onCreate,
  onSelect,
  className,
}: ResumeDetailPanelProps) {
  const card = status === 'success' && resume;
  const reveal = useReveal(status === 'success', resume?.id);
  return (
    <div
      className={cn(
        // No frame while it loads (§196): the placeholder is never a boxed patch.
        status === 'pending' ? cardSurfaceLoading : cardSurface,
        cardPad,
        // A resume's card keeps its header, actions and tabs in view and scrolls only the tab
        // (redesign R6a, audit RS-22); the other states scroll as one.
        card ? 'flex min-h-0 flex-col' : 'min-h-0 overflow-y-auto scrollbar-thin',
        className,
      )}
    >
      {status === 'empty' &&
        (hasAny ? (
          <StateView
            art={<EmptyStateArt object="palette" />}
            className="py-10"
            title="Select a resume"
            message="Choose one from the list to preview it."
          />
        ) : (
          <StateView
            art={<EmptyStateArt object="palette" />}
            className="py-10"
            title="Nothing to preview yet"
            message="Create a resume and its preview will show here."
            {...(onCreate ? { actionLabel: 'Create a resume', onAction: onCreate } : {})}
          />
        ))}

      {status === 'pending' && (
        // As tall as the card that replaces it: the header, actions, tabs and the preview.
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 rounded-md" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-control-lg w-2/3 rounded-md" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-112 w-full rounded-md" />
        </div>
      )}

      {(status === 'error' || (status === 'success' && !resume)) && (
        <StateView
          className="py-10"
          tone="danger"
          title="Couldn't load this resume"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={onRetry}
        />
      )}

      {status === 'success' && resume && (
        <ResumeDetailCard
          key={resume.id}
          resume={resume}
          reveal={reveal}
          {...(onSelect ? { onDuplicated: onSelect } : {})}
        />
      )}
    </div>
  );
}
