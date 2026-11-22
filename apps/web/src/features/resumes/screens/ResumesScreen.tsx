'use client';

import type { Resume, ResumeSort } from '@nextkin/shared/models';
import { queryPhase, useResumes } from '@nextkin/shared/queries';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/cn';
import { PageHeader } from '@/navigation/PageHeader';
import { replaceQuery } from '@/lib/replaceQuery';
import { CREATE_RESUME_EVENT } from '@/navigation/topBarEvents';
import { pageFillInBar, pageFrameInBar } from '@/ui/pageFrame';
import { PillTabs } from '@/ui/PillTabs';
import { ResultsBar } from '@/ui/ResultsBar';
import { StateView } from '@/ui/StateView';

import { CreateResumeDialog } from '../components/CreateResumeDialog';
import { ResumeDetailPanel } from '../components/ResumeDetailPanel';
import { ResumeFilterChipsRow } from '../components/ResumeFilterChipsRow';
import { ResumeList } from '../components/ResumeList';
import { ResumeSearchBar } from '../components/ResumeSearchBar';
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
 * is the selected resume's card; "Create New Resume" is the top bar's action (toreview §254). The
 * library's search and sort head the list they narrow. The pills count what the chips and the search leave, so a
 * pill and the count under it always agree. Selection works as on the other lists: an explicit
 * pick while it is in view, otherwise the list's first row, derived during render.
 */
export function ResumesScreen({ initialId }: { initialId?: string } = {}) {
  const [tab, setTab] = useState<ResumeTab>('all');
  const [filters, setFilters] = useState<ResumeFilters>(EMPTY_RESUME_FILTERS);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ResumeSort>('edited');
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);
  // The open resume is kept in the address, so a reload, Back or a shared link opens it again
  // (redesign R6a, audit RS-16).
  const select = (id: string) => {
    setSelectedId(id);
    replaceQuery('resume', id);
  };

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
  // Archived shows only while something is archived: nothing on the web archives yet (RS-05).
  const tabs = useMemo(
    () =>
      all.some((resume) => resume.archived)
        ? RESUME_TABS
        : RESUME_TABS.filter((pill) => pill.id !== 'archived'),
    [all],
  );
  const visible = useMemo(() => filtered.filter((resume) => inTab(tab, resume)), [filtered, tab]);

  // Data first: a failed background refresh leaves the list on screen (`toreview.md` §84).
  const listStatus = queryPhase(resumes);
  const selected = visible.find((resume) => resume.id === selectedId) ?? visible[0];
  const detailStatus = listStatus === 'success' ? (selected ? 'success' : 'empty') : listStatus;

  // "Reset" clears the chips and the search and keeps the group (RS-07).
  const narrowed =
    search.trim() !== '' ||
    filters.variants.length > 0 ||
    filters.roles.length > 0 ||
    filters.states.length > 0 ||
    filters.updatedWithin != null;
  const reset = () => {
    setFilters(EMPTY_RESUME_FILTERS);
    setSearch('');
  };
  // A list that never loaded is one error with one retry, not one per column.
  const failed = listStatus === 'error' && all.length === 0;

  // Four ways to a resume, and nothing is created until one is picked (toreview §124).
  const create = () => setCreating(true);
  // The top bar's "Create New Resume" asks for the same dialog (toreview §254).
  useEffect(() => {
    const open = () => setCreating(true);
    window.addEventListener(CREATE_RESUME_EVENT, open);
    return () => window.removeEventListener(CREATE_RESUME_EVENT, open);
  }, []);

  return (
    <div className={cn(pageFrameInBar, pageFillInBar, 'flex flex-col')}>
      <PageHeader
        eyebrow="Resumes"
        title="Build a resume that gets you hired"
        subtitle="Create, customize, and manage your resumes for every opportunity."
      />

      {failed ? (
        <div className="mt-6 flex flex-1 items-center justify-center">
          <StateView
            tone="danger"
            title="Couldn't load your resumes"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void resumes.refetch()}
          />
        </div>
      ) : (
        <div className="mt-4 grid min-h-0 flex-1 gap-6 md:grid-cols-[53fr_47fr]">
          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <ResumeSearchBar search={search} onSearchChange={setSearch} />
            <PillTabs
              tabs={tabs}
              active={tab}
              counts={listStatus === 'success' ? counts : undefined}
              onChange={setTab}
              label="Resume groups"
            />
            <ResumeFilterChipsRow
              filters={filters}
              onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
              onReset={reset}
              active={narrowed}
              resumes={all}
            />
            <ResultsBar
              count={listStatus === 'success' ? visible.length : undefined}
              loading={listStatus === 'pending'}
              noun={{ one: 'resume', other: 'resumes' }}
              sort={sort}
              sortOptions={RESUME_SORT_OPTIONS}
              onSortChange={setSort}
              sortLabel={`Sort by: ${RESUME_SORT_OPTIONS[sort]}`}
            />

            {/* The page's one scroller, 8px wider than the column either side so the selected
              row's ring and shadow aren't clipped. */}
            <div className="-mx-2 -mt-1 min-h-0 flex-1 overflow-y-auto px-2 pb-5 pt-1">
              <h2 className="sr-only">Your resumes</h2>
              <ResumeList
                resumes={visible}
                status={listStatus}
                hasAny={all.length > 0}
                selectedId={selected?.id}
                onSelect={select}
                onRetry={() => void resumes.refetch()}
                onReset={reset}
                onCreate={create}
              />
            </div>
          </div>

          <div className="relative flex min-h-0 min-w-0 flex-col pb-5">
            {/* The panel starts level with the list, as on the other lists: the character moved
              into its empty states and "Create New Resume" into the top bar (toreview §254). */}
            <ResumeDetailPanel
              resume={selected}
              status={detailStatus}
              hasAny={all.length > 0}
              onRetry={() => void resumes.refetch()}
              onCreate={create}
              onSelect={select}
            />
          </div>
        </div>
      )}
      <CreateResumeDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
