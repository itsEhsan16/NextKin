import { create } from 'zustand';

import {
  EMPLOYMENT_TYPE_LABEL,
  EMPTY_JOB_FILTERS,
  type JobFilters,
  type JobSort,
  type RemoteType,
} from '@/data/models';

/** The three tabs of the Jobs screen (Figma JOBS 01–03). */
export type JobsSegment = 'discover' | 'saved' | 'applied';

/** Status chips on the Applied tab (Figma 1:527). */
export type AppliedStatusFilter = 'all' | 'in_review' | 'interview' | 'closed';

/**
 * One removable chip in the Discover filter row. Keys are stable so removing a chip can undo
 * exactly the filter it represents.
 */
export type AppliedFilterChip = { key: string; label: string };

type JobsState = {
  segment: JobsSegment;
  /** Search text is per-tab: each tab has its own placeholder and its own result set. */
  queries: Record<JobsSegment, string>;
  filters: JobFilters;
  sort: JobSort;
  appliedStatus: AppliedStatusFilter;
  location: string;

  setSegment: (segment: JobsSegment) => void;
  setQuery: (segment: JobsSegment, value: string) => void;
  setSort: (sort: JobSort) => void;
  setAppliedStatus: (status: AppliedStatusFilter) => void;
  toggleRemoteOnly: () => void;
  removeFilter: (key: string) => void;
  clearFilters: () => void;
};

/**
 * Figma 1:289–1:296 ships three active chips: "Full-time", "Remote", "₹20L+".
 *
 * NOTE: the artboard is internally inconsistent — it shows a Remote chip applied while listing
 * on-site roles (Zoho · Chennai · On-site, CRED · Bengaluru · On-site). We seed the chips the
 * artboard shows and apply them for real, so removing one visibly changes the results; that
 * means the initial list is the correctly-filtered subset rather than the comp's literal list.
 * "Remote" is read as remote-friendly (remote or hybrid), which is the common job-board sense.
 */
/** "Remote" reads as remote-friendly, which is the common job-board sense. */
export const REMOTE_FRIENDLY: RemoteType[] = ['remote', 'hybrid'];

const INITIAL_FILTERS: JobFilters = {
  ...EMPTY_JOB_FILTERS,
  employmentTypes: ['full_time'],
  remote: REMOTE_FRIENDLY,
  salaryMin: 2_000_000,
};

export const useJobsStore = create<JobsState>((set) => ({
  segment: 'discover',
  queries: { discover: '', saved: '', applied: '' },
  filters: INITIAL_FILTERS,
  sort: 'relevance',
  appliedStatus: 'all',
  location: 'Bengaluru, India',

  setSegment: (segment) => set({ segment }),
  setQuery: (segment, value) =>
    set((state) => ({ queries: { ...state.queries, [segment]: value } })),
  setSort: (sort) => set({ sort }),
  setAppliedStatus: (appliedStatus) => set({ appliedStatus }),
  // The chip and the removable "Remote" pill are the same filter, so they can never disagree.
  toggleRemoteOnly: () =>
    set((state) => ({
      filters: {
        ...state.filters,
        remote: state.filters.remote.length > 0 ? [] : REMOTE_FRIENDLY,
      },
    })),

  removeFilter: (key) =>
    set((state) => {
      switch (key) {
        case 'salaryMin':
          return { filters: { ...state.filters, salaryMin: undefined } };
        case 'remote':
          return { filters: { ...state.filters, remote: [] } };
        case 'employmentTypes':
          return { filters: { ...state.filters, employmentTypes: [] } };
        default:
          return {
            filters: { ...state.filters, tags: state.filters.tags.filter((tag) => tag !== key) },
          };
      }
    }),

  clearFilters: () => set({ filters: EMPTY_JOB_FILTERS }),
}));

/** Derives the removable chips shown under the segmented control from the live filters. */
export function appliedFilterChips(filters: JobFilters): AppliedFilterChip[] {
  const chips: AppliedFilterChip[] = [];
  if (filters.employmentTypes.length > 0) {
    chips.push({
      key: 'employmentTypes',
      label: filters.employmentTypes.map((type) => EMPLOYMENT_TYPE_LABEL[type]).join(', '),
    });
  }
  if (filters.remote.length > 0) chips.push({ key: 'remote', label: 'Remote' });
  if (filters.salaryMin != null) {
    chips.push({ key: 'salaryMin', label: `₹${Math.round(filters.salaryMin / 100_000)}L+` });
  }
  chips.push(...filters.tags.map((tag) => ({ key: tag, label: tag })));
  return chips;
}

/** The "Remote only" chip is lit whenever the remote filter is active. */
export const isRemoteOnly = (filters: JobFilters): boolean => filters.remote.length > 0;
