import { useMemo } from 'react';

import { EMPTY_JOB_FILTERS } from '@/data/models';
import { useJobCount } from '@/data/queries';
import { useDebouncedValue } from '@/lib';
import { useLayoutScale, useTheme } from '@/theme';
import { Sheet } from '@/ui/Sheet';

import { FiltersSheetBody } from './components/FiltersSheetBody';
import { useJobsStore } from './jobsStore';

/**
 * Mounts JOBS 04 once, above the tab bar and the FAB so its scrim covers them (the artboard
 * paints the bottom nav *under* the scrim — unlike the create sheet, where the pill sits on top).
 *
 * State lives in `jobsStore` rather than a context: Apply has to commit filters, sort and the
 * open flag in one transaction, and splitting those across a context and the store would make it
 * a two-writer operation with no atomicity.
 */
export function FiltersSheetHost() {
  const { sizes } = useTheme();
  const { s } = useLayoutScale();

  const open = useJobsStore((state) => state.filtersOpen);
  const draft = useJobsStore((state) => state.draft);
  const discoverQuery = useJobsStore((state) => state.queries.discover);

  const closeFilters = useJobsStore((state) => state.closeFilters);
  const applyFilters = useJobsStore((state) => state.applyFilters);
  const resetDraft = useJobsStore((state) => state.resetDraft);
  const setDraftPostedWithin = useJobsStore((state) => state.setDraftPostedWithin);
  const toggleDraftEmploymentType = useJobsStore((state) => state.toggleDraftEmploymentType);
  const toggleDraftRemote = useJobsStore((state) => state.toggleDraftRemote);
  const toggleDraftExperience = useJobsStore((state) => state.toggleDraftExperience);
  const setDraftSalary = useJobsStore((state) => state.setDraftSalary);
  const setDraftSort = useJobsStore((state) => state.setDraftSort);

  // Discover folds its search box into the query at the call site, so the preview has to do the
  // same or it counts jobs the list would never show.
  // Memoised deliberately: `useDebouncedValue` compares by reference, so a fresh object literal
  // each render would re-arm its timer forever and never settle.
  const liveFilters = useMemo(
    () => (draft ? { ...draft.filters, query: discoverQuery || undefined } : EMPTY_JOB_FILTERS),
    [discoverQuery, draft],
  );
  // Debounced so a burst of pill taps — or a held screen-reader increment — coalesces into one
  // fetch. Dragging never reaches here at all: the slider commits only on release.
  const count = useJobCount(useDebouncedValue(liveFilters, 250));

  if (!draft) return null;

  return (
    <Sheet
      open={open}
      onClose={closeFilters}
      fill
      // The dismiss pan would fight both the scrolling body and the salary thumbs. The ✕, the
      // scrim and Android back all still dismiss, so swipe is not the only exit.
      swipeToDismiss={false}
      height={s(sizes.sheetFiltersHeight, 560)}
      accessibilityLabel="Filters"
    >
      <FiltersSheetBody
        draft={draft}
        count={count.data}
        countLoading={count.isPending}
        onClose={closeFilters}
        onReset={resetDraft}
        onApply={applyFilters}
        onPostedWithin={setDraftPostedWithin}
        onEmploymentType={toggleDraftEmploymentType}
        onRemote={toggleDraftRemote}
        onExperience={toggleDraftExperience}
        onSalary={setDraftSalary}
        onSort={setDraftSort}
      />
    </Sheet>
  );
}
