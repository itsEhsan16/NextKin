'use client';

import type { Resume, ResumeSort } from '@nextkin/shared/models';
import { queryPhase, useCurrentUser, useResumes } from '@nextkin/shared/queries';
import { useDeferredValue, useMemo, useState } from 'react';

import { cn } from '@/lib/cn';
import { PageHeader } from '@/navigation/PageHeader';
import { brandButton } from '@/ui/brandButton';
import { PlusIcon } from '@/ui/icons';
import { pageFillInBar, pageFillMin, pageFrameInBar } from '@/ui/pageFrame';
import { PillTabs } from '@/ui/PillTabs';
import { ResultsBar } from '@/ui/ResultsBar';
import { StateView } from '@/ui/StateView';

import { CreateResumeDialog } from '../components/CreateResumeDialog';
import { ResumeDetailPanel } from '../components/ResumeDetailPanel';
import { ResumeFilterChipsRow } from '../components/ResumeFilterChipsRow';
import { ResumeList } from '../components/ResumeList';
import { ResumesIllustration } from '../components/ResumesIllustration';
import {
  EMPTY_RESUME_FILTERS,
  matchesResumeFilters,
  matchesResumeSearch,
  type ResumeFilters,
} from '../resumeFilters';
import {
  countByTab,
  inTab,
  RESUME_SORT_OPTIONS,
  RESUME_TABS,
  type ResumeTab,
} from '../resumeLibrary';

const NONE: Resume[] = [];

/**
 * "04 · Resumes" (286:1675): the other lists' frame around the resume library, at the compact
 * density (`toreview.md` §16) in the board's own 53:47 split, which gives the preview more room
 * than Jobs and Applications give their cards.
 *
 * The pills, chips and count sit over a list that is the page's one scroller. The right column
 * opens with "Create New Resume" and the character, then the panel: the library's search and sort,
 * and the selected document's card. The pills count what the chips and the search leave, so a
 * pill and the count under it always agree. Selection works as on the other lists: an explicit
 * pick while it is in view, otherwise the list's first row, derived during render.
 */
export function ResumesScreen({ initialId }: { initialId?: string } = {}) {
  const [tab, setTab] = useState<ResumeTab>('all');
  const [filters, setFilters] = useState<ResumeFilters>(EMPTY_RESUME_FILTERS);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ResumeSort>('edited');
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);

  const user = useCurrentUser();
  const resumes = useResumes(sort);
  const [creating, setCreating] = useState(false);

  const all = resumes.data ?? NONE;
  // The field echoes every keystroke at once; the list follows at a lower priority, so typing
  // never waits on the page re-rendering.
  const query = useDeferredValue(search);
  const filtered = useMemo(
    () =>
      all.filter(
        (resume) => matchesResumeFilters(resume, filters) && matchesResumeSearch(resume, query),
      ),
    [all, filters, query],
  );
  const counts = useMemo(() => countByTab(filtered), [filtered]);
  const visible = useMemo(() => filtered.filter((resume) => inTab(tab, resume)), [filtered, tab]);

  // Data first: a failed background refresh leaves the list on screen (`toreview.md` §84).
  const listStatus = queryPhase(resumes);
  const selected = visible.find((resume) => resume.id === selectedId) ?? visible[0];
  const detailStatus = listStatus === 'success' ? (selected ? 'success' : 'empty') : listStatus;

  const reset = () => {
    setFilters(EMPTY_RESUME_FILTERS);
    setTab('all');
    setSearch('');
  };

  // Four ways to a resume, and nothing is created until one is picked (toreview §124).
  const create = () => setCreating(true);

  if (queryPhase(user) === 'error') {
    return (
      <div className={cn(pageFillMin, 'flex items-center justify-center')}>
        <StateView
          tone="danger"
          title="Something went wrong"
          message="We couldn't load your resumes. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void user.refetch()}
        />
      </div>
    );
  }

  return (
    <div className={cn(pageFrameInBar, pageFillInBar, 'flex flex-col')}>
      <PageHeader
        eyebrow="Resumes"
        title="Build a resume that gets you hired"
        subtitle="Create, customize, and manage your resumes for every opportunity."
      />

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[53fr_47fr] gap-6">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <PillTabs
            tabs={RESUME_TABS}
            active={tab}
            counts={listStatus === 'success' ? counts : undefined}
            onChange={setTab}
            label="Resume groups"
          />
          <ResumeFilterChipsRow
            filters={filters}
            onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
            onReset={reset}
            resumes={all}
          />
          <ResultsBar
            count={listStatus === 'success' ? visible.length : undefined}
            loading={listStatus === 'pending'}
            noun={{ one: 'resume found', other: 'resumes found' }}
            sort={sort}
            sortOptions={RESUME_SORT_OPTIONS}
            onSortChange={setSort}
            sortLabel={`Sort by: ${RESUME_SORT_OPTIONS[sort]}`}
          />

          {/* The page's one scroller, 8px wider than the column either side so the selected
              row's ring and shadow aren't clipped. */}
          <div className="-mx-2 -mt-1 min-h-0 flex-1 overflow-y-auto px-2 pb-5 pt-1 [scrollbar-width:thin]">
            <ResumeList
              resumes={visible}
              status={listStatus}
              hasAny={all.length > 0}
              selectedId={selected?.id}
              onSelect={setSelectedId}
              onRetry={() => void resumes.refetch()}
              onReset={reset}
              onCreate={create}
            />
          </div>
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-col pb-5">
          {/* Where the board puts the character (307:4012): over the panel's top-left corner,
              rising out of the header band, its feet a few px under the panel's top edge and
              "Create New Resume" to its right. Anchored to this column, like the other pages'
              art, so it holds its place at every width with the sidebar open or shut. Painted
              first: the button row and the panel sit above it. */}
          <ResumesIllustration className="absolute -left-1 -top-[23px]" />

          <div className="relative flex justify-end">
            <button
              type="button"
              onClick={create}
              aria-haspopup="dialog"
              className={cn(
                brandButton,
                'h-control-lg gap-2 rounded-md px-5 text-body-l font-semibold',
              )}
            >
              <PlusIcon className="size-4" />
              Create New Resume
            </button>
          </div>

          <ResumeDetailPanel
            className="relative mt-3"
            resume={selected}
            status={detailStatus}
            hasAny={all.length > 0}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
            onRetry={() => void resumes.refetch()}
            onCreate={create}
          />
        </div>
      </div>
      <CreateResumeDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
