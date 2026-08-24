import { create } from 'zustand';

import {
  EMPLOYMENT_TYPE_LABEL,
  EMPTY_JOB_FILTERS,
  EXPERIENCE_LEVEL_LABEL,
  POSTED_WITHIN_LABEL,
  REMOTE_TYPE_LABEL,
  SALARY_FILTER_MAX,
  SALARY_FILTER_MIN,
  type EmploymentType,
  type ExperienceLevel,
  type JobFilters,
  type JobSort,
  type PostedWithin,
  type RemoteType,
} from '@/data/models';
import { formatSalaryBand } from '@/lib';

/** The three tabs of the Jobs screen (Figma JOBS 01–03). */
export type JobsSegment = 'discover' | 'saved' | 'applied';

/** Status chips on the Applied tab (Figma 1:527). */
export type AppliedStatusFilter = 'all' | 'in_review' | 'interview' | 'closed';

/**
 * One removable chip in the Discover filter row. Keys are stable so removing a chip can undo
 * exactly the filter it represents.
 */
export type AppliedFilterChip = { key: string; label: string };

/** What the filter sheet edits. Nothing here reaches the list until Apply (Figma JOBS 04). */
export type JobFilterDraft = { filters: JobFilters; sort: JobSort };

type JobsState = {
  segment: JobsSegment;
  /** Search text is per-tab: each tab has its own placeholder and its own result set. */
  queries: Record<JobsSegment, string>;
  filters: JobFilters;
  sort: JobSort;
  appliedStatus: AppliedStatusFilter;
  location: string;

  filtersOpen: boolean;
  /** Null until the sheet is first opened; retained after close — see `closeFilters`. */
  draft: JobFilterDraft | null;

  setSegment: (segment: JobsSegment) => void;
  setQuery: (segment: JobsSegment, value: string) => void;
  setSort: (sort: JobSort) => void;
  setAppliedStatus: (status: AppliedStatusFilter) => void;
  toggleRemoteOnly: () => void;
  removeFilter: (key: string) => void;
  clearFilters: () => void;

  openFilters: () => void;
  closeFilters: () => void;
  applyFilters: () => void;
  resetDraft: () => void;
  setDraftPostedWithin: (value: PostedWithin | undefined) => void;
  toggleDraftEmploymentType: (type: EmploymentType) => void;
  toggleDraftRemote: (type: RemoteType) => void;
  toggleDraftExperience: (level: ExperienceLevel | undefined) => void;
  setDraftSalary: (min: number, max: number) => void;
  setDraftSort: (sort: JobSort) => void;
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

/**
 * No `salaryMax`: JOBS 04's slider label says ₹20L–₹45L but JOBS 01's chip — the screen that
 * actually ships — says "₹20L+", and its handle positions agree with neither. Seeding only the
 * floor honours the shipped chip and parks the upper thumb on the "₹80L+" top stop.
 */
const INITIAL_FILTERS: JobFilters = {
  ...EMPTY_JOB_FILTERS,
  employmentTypes: ['full_time'],
  remote: REMOTE_FRIENDLY,
  salaryMin: 2_000_000,
};

/** Adds or removes one member of a multi-select filter group. */
const toggleIn = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

export const useJobsStore = create<JobsState>((set) => {
  /** Applies an edit to the draft's filters, or no-ops when the sheet has never been opened. */
  const editDraft = (fn: (filters: JobFilters) => JobFilters) => (state: JobsState) =>
    state.draft ? { draft: { ...state.draft, filters: fn(state.draft.filters) } } : {};

  return {
    segment: 'discover',
    queries: { discover: '', saved: '', applied: '' },
    filters: INITIAL_FILTERS,
    sort: 'relevance',
    appliedStatus: 'all',
    location: 'Bengaluru, India',
    filtersOpen: false,
    draft: null,

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
          // One chip covers both bounds, so removing it clears the whole band.
          case 'salary':
            return { filters: { ...state.filters, salaryMin: undefined, salaryMax: undefined } };
          case 'remote':
            return { filters: { ...state.filters, remote: [] } };
          case 'employmentTypes':
            return { filters: { ...state.filters, employmentTypes: [] } };
          case 'experienceLevels':
            return { filters: { ...state.filters, experienceLevels: [] } };
          case 'postedWithin':
            return { filters: { ...state.filters, postedWithin: undefined } };
          default:
            return {
              filters: { ...state.filters, tags: state.filters.tags.filter((tag) => tag !== key) },
            };
        }
      }),

    clearFilters: () => set({ filters: EMPTY_JOB_FILTERS }),

    openFilters: () =>
      set((state) => ({
        filtersOpen: true,
        draft: { filters: state.filters, sort: state.sort },
      })),

    // The draft is deliberately NOT cleared: doing so would empty the sheet mid-exit, during the
    // 200ms dismiss. `openFilters` re-seeds on every open, so it can never go stale.
    closeFilters: () => set({ filtersOpen: false }),

    applyFilters: () =>
      set((state) =>
        state.draft
          ? { filters: state.draft.filters, sort: state.draft.sort, filtersOpen: false }
          : { filtersOpen: false },
      ),

    // Draft-only: Reset sits beside Apply in the sticky bar, so committing here would make Apply
    // meaningless. The live "Show N jobs" count is the immediate feedback instead.
    resetDraft: () => set({ draft: { filters: EMPTY_JOB_FILTERS, sort: 'relevance' } }),

    setDraftPostedWithin: (postedWithin) => set(editDraft((f) => ({ ...f, postedWithin }))),

    toggleDraftEmploymentType: (type) =>
      set(editDraft((f) => ({ ...f, employmentTypes: toggleIn(f.employmentTypes, type) }))),

    toggleDraftRemote: (type) => set(editDraft((f) => ({ ...f, remote: toggleIn(f.remote, type) }))),

    // `undefined` is the "Any" pill, which clears the group rather than being a level of its own.
    toggleDraftExperience: (level) =>
      set(
        editDraft((f) => ({
          ...f,
          experienceLevels: level ? toggleIn(f.experienceLevels, level) : [],
        })),
      ),

    // A thumb parked on either end stop means "no bound", so the band round-trips as undefined
    // and the chip can read "₹20L+" rather than "₹20L–₹80L".
    setDraftSalary: (min, max) =>
      set(
        editDraft((f) => ({
          ...f,
          salaryMin: min <= SALARY_FILTER_MIN ? undefined : min,
          salaryMax: max >= SALARY_FILTER_MAX ? undefined : max,
        })),
      ),

    setDraftSort: (sort) =>
      set((state) => (state.draft ? { draft: { ...state.draft, sort } } : {})),
  };
});

/** Exactly remote+hybrid is the "Remote" the artboard ships (JOBS 01 chip 1:292). */
function remoteLabel(types: RemoteType[]): string {
  const remoteFriendly =
    types.length === REMOTE_FRIENDLY.length && types.every((t) => REMOTE_FRIENDLY.includes(t));
  return remoteFriendly ? 'Remote' : types.map((type) => REMOTE_TYPE_LABEL[type]).join(', ');
}

/**
 * Derives the removable chips shown under the segmented control from the live filters. Group
 * order mirrors the filter sheet, so the chip row and the sheet read alike — and every group the
 * sheet can set appears here, or the filter-count badge would under-report.
 */
export function appliedFilterChips(filters: JobFilters): AppliedFilterChip[] {
  const chips: AppliedFilterChip[] = [];
  if (filters.postedWithin) {
    chips.push({ key: 'postedWithin', label: POSTED_WITHIN_LABEL[filters.postedWithin] });
  }
  if (filters.employmentTypes.length > 0) {
    chips.push({
      key: 'employmentTypes',
      label: filters.employmentTypes.map((type) => EMPLOYMENT_TYPE_LABEL[type]).join(', '),
    });
  }
  if (filters.remote.length > 0) chips.push({ key: 'remote', label: remoteLabel(filters.remote) });
  if (filters.salaryMin != null || filters.salaryMax != null) {
    chips.push({
      key: 'salary',
      label: formatSalaryBand(filters.salaryMin, filters.salaryMax, SALARY_FILTER_MAX, '–'),
    });
  }
  if (filters.experienceLevels.length > 0) {
    chips.push({
      key: 'experienceLevels',
      label: filters.experienceLevels.map((level) => EXPERIENCE_LEVEL_LABEL[level]).join(', '),
    });
  }
  chips.push(...filters.tags.map((tag) => ({ key: tag, label: tag })));
  return chips;
}

/**
 * The "Remote only" chip is lit only when every picked workplace is remote-friendly — picking
 * On-site in the filter sheet must not light a chip that says the opposite.
 */
export const isRemoteOnly = (filters: JobFilters): boolean =>
  filters.remote.length > 0 && filters.remote.every((type) => REMOTE_FRIENDLY.includes(type));
