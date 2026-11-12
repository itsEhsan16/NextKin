'use client';

import type { Resume, ResumeSort } from '@nextkin/shared/models';
import { queryPhase, useResumes } from '@nextkin/shared/queries';
import { useDeferredValue, useMemo, useState } from 'react';

import { cn } from '@/lib/cn';
import { PageHeader } from '@/navigation/PageHeader';
import { replaceQuery } from '@/lib/replaceQuery';
import { Button } from '@/ui/Button';
import { PlusIcon } from '@/ui/icons';
import { pageFillInBar, pageFrameInBar } from '@/ui/pageFrame';
import { PillTabs } from '@/ui/PillTabs';
import { ResultsBar } from '@/ui/ResultsBar';
import { StateView } from '@/ui/StateView';

import { CreateResumeDialog } from '../components/CreateResumeDialog';
import { ResumeDetailPanel } from '../components/ResumeDetailPanel';
import { ResumeFilterChipsRow } from '../components/ResumeFilterChipsRow';
import { ResumeList } from '../components/ResumeList';
import { ResumeSearchBar } from '../components/ResumeSearchBar';
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
 * opens with "Create New Resume" and the character, then the selected document's card. The
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

  // "Clear filters" clears the chips and the search and keeps the group (RS-07).
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
  // A first visit has nothing to search or filter: one empty state, one way on (RS-11).
  const firstRun = listStatus === 'success' && all.length === 0;
  // A list that never loaded is one error with one retry, not one per column.
  const failed = listStatus === 'error' && all.length === 0;

  // Four ways to a resume, and nothing is created until one is picked (toreview §124).
  const create = () => setCreating(true);

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
      ) : firstRun ? (
        <div className="mt-6 flex flex-1 items-center justify-center">
          <StateView
            title="No resumes yet"
            message="Tailor one to a job, build one from your profile, upload the one you have, or start from a blank page."
            actionLabel="Create your first resume"
            onAction={create}
          />
        </div>
      ) : (
        <div className="mt-6 grid min-h-0 flex-1 gap-6 md:grid-cols-[53fr_47fr]">
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
              noun={{ one: 'resume found', other: 'resumes found' }}
              sort={sort}
              sortOptions={RESUME_SORT_OPTIONS}
              onSortChange={setSort}
              sortLabel={`Sort by: ${RESUME_SORT_OPTIONS[sort]}`}
            />

            {/* The page's one scroller, 8px wider than the column either side so the selected
              row's ring and shadow aren't clipped. */}
            <div className="-mx-2 -mt-1 min-h-0 flex-1 overflow-y-auto px-2 pb-5 pt-1 scrollbar-thin">
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
            {/* Where the board puts the character (307:4012): over the panel's top-left corner,
              rising out of the header band, its feet a few px under the panel's top edge and
              "Create New Resume" to its right. Anchored to this column, like the other pages'
              art, so it holds its place at every width with the sidebar open or shut. Painted
              first: the button row and the panel sit above it. */}
            <ResumesIllustration className="absolute -left-1 -top-6" />

            <div className="relative flex justify-end">
              {/* The shared button, demoted beside the card's "Edit Resume" so the work area has one
                primary (redesign R6a, audit RS-15). */}
              <Button
                variant="brand-secondary"
                size="lg"
                onClick={create}
                aria-haspopup="dialog"
                icon={<PlusIcon className="size-4" />}
              >
                Create New Resume
              </Button>
            </div>

            <ResumeDetailPanel
              className="relative mt-4"
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
