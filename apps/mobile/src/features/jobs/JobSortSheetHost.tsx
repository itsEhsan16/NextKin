import { useCallback } from 'react';

import { OptionSheet } from '@/ui/OptionSheet';

import { useJobsStore } from './jobsStore';
import {
  JOB_SORT_OPTIONS,
  SAVED_JOBS_SORT_OPTIONS,
  isJobSort,
  isSavedJobsSort,
  type AnyJobSort,
} from './sortOptions';

/**
 * The sort picker behind the "Sort by …" control on Discover and Saved. Hosted over the tab bar
 * beside `FiltersSheetHost` rather than pushed, so the list stays behind its scrim.
 *
 * One sheet, two unions: Discover sorts by `JobSort`, Saved by `SavedJobsSort` — a saved job has
 * no search left to be relevant to. Applied has no sort control at all, so nothing mounts there.
 */
export function JobSortSheetHost() {
  const segment = useJobsStore((state) => state.segment);
  const open = useJobsStore((state) => state.sortOpen);
  const sort = useJobsStore((state) => state.sort);
  const savedSort = useJobsStore((state) => state.savedSort);
  const closeSort = useJobsStore((state) => state.closeSort);
  const setSort = useJobsStore((state) => state.setSort);
  const setSavedSort = useJobsStore((state) => state.setSavedSort);

  const saved = segment === 'saved';

  const handleSelect = useCallback(
    (key: AnyJobSort) => {
      // The unions overlap on 'recent' and 'salary', so the segment decides which setter is
      // written and the guard proves the key belongs to that union.
      if (saved) {
        if (isSavedJobsSort(key)) setSavedSort(key);
      } else if (isJobSort(key)) {
        setSort(key);
      }
      closeSort();
    },
    [closeSort, saved, setSavedSort, setSort],
  );

  if (segment === 'applied') return null;

  return (
    <OptionSheet<AnyJobSort>
      open={open}
      title={saved ? 'Sort saved jobs' : 'Sort jobs'}
      options={saved ? SAVED_JOBS_SORT_OPTIONS : JOB_SORT_OPTIONS}
      selectedKey={saved ? savedSort : sort}
      onSelect={handleSelect}
      onClose={closeSort}
    />
  );
}
