import { useCallback } from 'react';

import type { ResumeSort } from '@/data/models';
import { OptionSheet } from '@/ui/OptionSheet';

import { RESUME_SORT_OPTIONS } from './resumeSortOptions';
import { useResumesStore } from './resumesStore';

/**
 * The sort picker behind the library's "Sort by …" control. Hosted over the tab bar beside the
 * jobs sort sheet rather than pushed, so the grid stays behind its scrim — the shape 9H settled
 * for Discover and Saved.
 */
export function ResumeSortSheetHost() {
  const open = useResumesStore((state) => state.sortOpen);
  const sort = useResumesStore((state) => state.sort);
  const setSort = useResumesStore((state) => state.setSort);
  const closeSort = useResumesStore((state) => state.closeSort);

  const handleSelect = useCallback(
    (key: ResumeSort) => {
      setSort(key);
      closeSort();
    },
    [closeSort, setSort],
  );

  return (
    <OptionSheet<ResumeSort>
      open={open}
      title="Sort documents"
      options={RESUME_SORT_OPTIONS}
      selectedKey={sort}
      onSelect={handleSelect}
      onClose={closeSort}
    />
  );
}
