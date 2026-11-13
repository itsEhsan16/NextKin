'use client';

import type { ApplicationStatus, ApplicationWithJob } from '@nextkin/shared/models';
import { queryPhase, useApplications, useUpdateApplicationStatus } from '@nextkin/shared/queries';
import { useMemo, useState } from 'react';

import { cn } from '@/lib/cn';
import { showToast } from '@/lib/toast';
import { PageHeader } from '@/navigation/PageHeader';
import { pageFillInBar, pageFrameInBar } from '@/ui/pageFrame';
import { PillTabs } from '@/ui/PillTabs';
import { ResultsBar } from '@/ui/ResultsBar';
import { StateView } from '@/ui/StateView';

import {
  APPLICATION_COMPARATORS,
  APPLICATION_SORT_LABEL,
  EMPTY_APPLICATION_FILTERS,
  matchesApplicationFilters,
  type ApplicationFilters,
  type ApplicationSort,
} from '../applicationFilters';
import {
  countByTab,
  inTab,
  STAGE_LABEL,
  STAGE_TABS,
  stageOf,
  type StageTab,
} from '../applicationStage';
import { ApplicationDetailPanel } from '../components/ApplicationDetailPanel';
import { ApplicationFilterChipsRow } from '../components/ApplicationFilterChipsRow';
import { ApplicationList } from '../components/ApplicationList';

const NONE: ApplicationWithJob[] = [];

/**
 * "03 · Applications" (286:1234): the Jobs page's frame around the account's applications. The
 * status pills, the filter chips and the count sit over a list that is the page's one scroller,
 * and the selected application's card stays put beside it, at the compact density
 * (`toreview.md` §16) and the same 56:44 split.
 *
 * The pills count what the chips leave, so a pill and the count under it always agree. Selection
 * works as on Jobs: an explicit pick while it is in view, otherwise the list's first row, derived
 * during render.
 */
export function ApplicationsScreen({ initialId }: { initialId?: string } = {}) {
  const [tab, setTab] = useState<StageTab>('all');
  const [filters, setFilters] = useState<ApplicationFilters>(EMPTY_APPLICATION_FILTERS);
  const [sort, setSort] = useState<ApplicationSort>('recent');
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);

  const applications = useApplications();
  const updateStatus = useUpdateApplicationStatus();

  const all = applications.data ?? NONE;
  const filtered = useMemo(
    () => all.filter((row) => matchesApplicationFilters(row, filters)),
    [all, filters],
  );
  const counts = useMemo(() => countByTab(filtered), [filtered]);
  const visible = useMemo(
    () => filtered.filter((row) => inTab(tab, stageOf(row))).sort(APPLICATION_COMPARATORS[sort]),
    [filtered, tab, sort],
  );

  // Data first: a failed background refresh leaves the list on screen (`toreview.md` §84).
  const listStatus = queryPhase(applications);
  const selected = visible.find((row) => row.application.id === selectedId) ?? visible[0];
  const detailStatus = listStatus === 'success' ? (selected ? 'success' : 'empty') : listStatus;

  const reset = () => {
    setFilters(EMPTY_APPLICATION_FILTERS);
    setTab('all');
  };

  // Where it moved, with the way back; a failure says so and the badge goes back (AP-08).
  const changeStatus = (row: ApplicationWithJob, status: ApplicationStatus) => {
    const before = row.application.status;
    const id = row.application.id;
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () =>
          showToast(`Moved to ${STAGE_LABEL[status]}`, {
            action: {
              label: 'Undo',
              onClick: () => updateStatus.mutate({ id, status: before }),
            },
          }),
        onError: () => showToast('We couldn’t update the status. Try again.', { tone: 'error' }),
      },
    );
  };

  return (
    <div className={cn(pageFrameInBar, pageFillInBar, 'flex flex-col')}>
      <PageHeader
        eyebrow="Applications"
        title="Track your progress"
        subtitle="Stay organized, follow up, and never miss an opportunity."
      />

      {/* A list that never loaded is one error with one retry, not one per column; the user query
          no longer gates the page (redesign R6d). */}
      {listStatus === 'error' && all.length === 0 ? (
        <div className="mt-6 flex flex-1 items-center justify-center">
          <StateView
            tone="danger"
            title="Couldn't load your applications"
            message="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void applications.refetch()}
          />
        </div>
      ) : (
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-[56fr_44fr] gap-6">
          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <PillTabs
              tabs={STAGE_TABS}
              active={tab}
              counts={listStatus === 'success' ? counts : undefined}
              onChange={setTab}
              label="Application status"
              compact
            />
            <ApplicationFilterChipsRow
              filters={filters}
              onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
              onReset={reset}
              rows={all}
            />
            <ResultsBar
              count={listStatus === 'success' ? visible.length : undefined}
              loading={listStatus === 'pending'}
              noun={{ one: 'application', other: 'applications' }}
              sort={sort}
              sortOptions={APPLICATION_SORT_LABEL}
              onSortChange={setSort}
              sortLabel={`Sort by: ${APPLICATION_SORT_LABEL[sort]}`}
            />

            {/* The page's one scroller, 8px wider than the column either side so the selected
              row's ring and shadow aren't clipped. */}
            <div className="-mx-2 -mt-1 min-h-0 flex-1 overflow-y-auto px-2 pb-5 pt-1 scrollbar-thin">
              <ApplicationList
                rows={visible}
                status={listStatus}
                hasAny={all.length > 0}
                selectedId={selected?.application.id}
                onSelect={setSelectedId}
                onRetry={() => void applications.refetch()}
                onReset={reset}
              />
            </div>
          </div>

          <div className="relative flex min-h-0 min-w-0 flex-col pb-5">
            <ApplicationDetailPanel
              row={selected}
              status={detailStatus}
              hasAny={all.length > 0}
              onRetry={() => void applications.refetch()}
              saving={updateStatus.isPending}
              onUpdateStatus={(status) => selected && changeStatus(selected, status)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
