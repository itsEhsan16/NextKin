'use client';

import type { CareerDocument } from '@nextkin/shared/models';
import { queryPhase, useCurrentUser, useDocuments } from '@nextkin/shared/queries';
import { useDeferredValue, useMemo, useState } from 'react';

import { cn } from '@/lib/cn';
import { PageHeader } from '@/navigation/PageHeader';
import { pageFillInBar, pageFillMin, pageFrameInBar } from '@/ui/pageFrame';
import { PillTabs } from '@/ui/PillTabs';
import { ResultsBar } from '@/ui/ResultsBar';
import { StateView } from '@/ui/StateView';

import { DocumentDetailPanel } from '../components/DocumentDetailPanel';
import { DocumentList } from '../components/DocumentList';
import { DocumentsIllustration } from '../components/DocumentsIllustration';
import { DocumentsToolbar } from '../components/DocumentsToolbar';
import {
  countByTab,
  DOCUMENT_COMPARATORS,
  DOCUMENT_SORT_OPTIONS,
  DOCUMENT_TABS,
  inTab,
  matchesDocumentSearch,
  type DocumentSort,
  type DocumentTab,
  type DocumentView,
} from '../documentLibrary';

const NONE: CareerDocument[] = [];

/**
 * "05 · Documents" (286:2026): the other lists' frame around the candidate's own files, at the
 * compact density (`toreview.md` §16) in the board's 55:45 split.
 *
 * The search, sort and layout switch, the pills and the count sit over a list that is the page's
 * one scroller. The right column opens with the character, then the open document's card and the
 * way into applying with it. The pills count what the search leaves, so a pill and the count under
 * it always agree. Selection works as on the other lists: an explicit pick while it is in view,
 * otherwise the list's first row, derived during render.
 */
export function DocumentsScreen() {
  const [tab, setTab] = useState<DocumentTab>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<DocumentSort>('updated');
  const [view, setView] = useState<DocumentView>('list');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const user = useCurrentUser();
  const documents = useDocuments();

  const all = documents.data ?? NONE;
  // The field echoes every keystroke at once; the list follows at a lower priority, so typing
  // never waits on the page re-rendering.
  const query = useDeferredValue(search);
  const searched = useMemo(
    () => all.filter((document) => matchesDocumentSearch(document, query)),
    [all, query],
  );
  const counts = useMemo(() => countByTab(searched), [searched]);
  const visible = useMemo(
    () => searched.filter((document) => inTab(tab, document)).sort(DOCUMENT_COMPARATORS[sort]),
    [searched, tab, sort],
  );

  // Data first: a failed background refresh leaves the list on screen (`toreview.md` §84).
  const listStatus = queryPhase(documents);
  const selected = visible.find((document) => document.id === selectedId) ?? visible[0];
  const detailStatus = listStatus === 'success' ? (selected ? 'success' : 'empty') : listStatus;

  const reset = () => {
    setTab('all');
    setSearch('');
  };

  if (queryPhase(user) === 'error') {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          tone="danger"
          title="Something went wrong"
          message="We couldn't load your documents. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void user.refetch()}
        />
      </div>
    );
  }

  return (
    <div className={cn(pageFrameInBar, pageFillInBar, 'flex flex-col')}>
      <PageHeader
        eyebrow="Documents"
        title="Keep everything in one place"
        subtitle="Organize your important career documents and access them anytime."
      />

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[55fr_45fr] gap-6">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <DocumentsToolbar
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
            view={view}
            onViewChange={setView}
          />
          <PillTabs
            tabs={DOCUMENT_TABS}
            active={tab}
            counts={listStatus === 'success' ? counts : undefined}
            onChange={setTab}
            label="Document types"
          />
          <ResultsBar
            count={listStatus === 'success' ? visible.length : undefined}
            loading={listStatus === 'pending'}
            noun={{ one: 'document', other: 'documents' }}
            sort={sort}
            sortOptions={DOCUMENT_SORT_OPTIONS}
            onSortChange={setSort}
            sortLabel={`Sort by: ${DOCUMENT_SORT_OPTIONS[sort]}`}
          />

          {/* The page's one scroller, 8px wider than the column either side so the selected
              row's ring and shadow aren't clipped. */}
          <div className="-mx-2 -mt-1 min-h-0 flex-1 overflow-y-auto px-2 pb-5 pt-1 [scrollbar-width:thin]">
            <DocumentList
              documents={visible}
              status={listStatus}
              hasAny={all.length > 0}
              view={view}
              selectedId={selected?.id}
              onSelect={setSelectedId}
              onRetry={() => void documents.refetch()}
              onReset={reset}
            />
          </div>
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-col pb-5">
          {/* Where the board puts the character (304:683): over the card's top-left corner, rising
              out of the header band with its feet 8px under the card's top edge, the caption to its
              right. The card starts 36px down this column to give it that room. Anchored to the
              column, like the other pages' art, so it holds at every width with the sidebar open
              or shut. Painted first: the card sits above it. */}
          <DocumentsIllustration className="absolute -left-1 -top-12" />

          <DocumentDetailPanel
            className="relative mt-9"
            document={selected}
            status={detailStatus}
            hasAny={all.length > 0}
            onRetry={() => void documents.refetch()}
          />
        </div>
      </div>
    </div>
  );
}
