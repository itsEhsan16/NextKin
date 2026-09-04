import {
  EMPLOYMENT_TYPE_LABEL,
  EMPTY_JOB_FILTERS,
  SALARY_FILTER_MAX,
  SALARY_FILTER_MIN,
} from '@/data/models';
import { appliedFilterChips, isRemoteOnly, useJobsStore } from '@/features/jobs';
import { REMOTE_FRIENDLY } from '@/features/jobs/jobsStore';

const INITIAL = useJobsStore.getState();

describe('jobs filter state', () => {
  beforeEach(() => {
    useJobsStore.setState(INITIAL, true);
  });

  it('derives the three chips the Discover artboard ships with', () => {
    const chips = appliedFilterChips(useJobsStore.getState().filters);

    expect(chips.map((chip) => chip.label)).toEqual([
      EMPLOYMENT_TYPE_LABEL.full_time,
      'Remote',
      '₹20L+',
    ]);
  });

  it('removes exactly the filter a chip represents', () => {
    // One chip now covers both salary bounds, so the key names the band rather than the floor.
    useJobsStore.getState().removeFilter('salary');
    expect(useJobsStore.getState().filters.salaryMin).toBeUndefined();
    expect(useJobsStore.getState().filters.salaryMax).toBeUndefined();
    expect(appliedFilterChips(useJobsStore.getState().filters).map((chip) => chip.key)).toEqual([
      'employmentTypes',
      'remote',
    ]);

    useJobsStore.getState().removeFilter('remote');
    expect(useJobsStore.getState().filters.remote).toEqual([]);
  });

  it('clears every chip at once', () => {
    useJobsStore.getState().clearFilters();
    expect(appliedFilterChips(useJobsStore.getState().filters)).toEqual([]);
  });

  it('keeps a separate search query per tab', () => {
    useJobsStore.getState().setQuery('saved', 'stripe');
    expect(useJobsStore.getState().queries.saved).toBe('stripe');
    expect(useJobsStore.getState().queries.discover).toBe('');
  });

  it('lights "Remote only" for remote-friendly picks but not for on-site', () => {
    expect(isRemoteOnly(useJobsStore.getState().filters)).toBe(true);
    expect(isRemoteOnly({ ...EMPTY_JOB_FILTERS, remote: ['onsite'] })).toBe(false);
    expect(isRemoteOnly({ ...EMPTY_JOB_FILTERS, remote: ['remote', 'onsite'] })).toBe(false);
  });

  it('counts every filter group as a chip, so the badge cannot under-report', () => {
    const chips = appliedFilterChips({
      ...EMPTY_JOB_FILTERS,
      postedWithin: '7d',
      employmentTypes: ['full_time'],
      remote: ['onsite'],
      salaryMin: 2_000_000,
      salaryMax: 4_500_000,
      experienceLevels: ['senior', 'lead'],
    });

    expect(chips).toEqual([
      { key: 'postedWithin', label: 'Past week' },
      { key: 'employmentTypes', label: 'Full-time' },
      { key: 'remote', label: 'On-site' },
      { key: 'salary', label: '₹20L–₹45L' },
      { key: 'experienceLevels', label: 'Senior, Lead' },
    ]);
  });
});

describe('filter sheet draft (JOBS 04)', () => {
  beforeEach(() => {
    useJobsStore.setState(INITIAL, true);
  });

  it('seeds the draft from the live filters when it opens', () => {
    useJobsStore.getState().openFilters();

    const { filtersOpen, draft, filters, sort } = useJobsStore.getState();
    expect(filtersOpen).toBe(true);
    expect(draft).toEqual({ filters, sort });
  });

  it('keeps draft edits out of the live filters until Apply', () => {
    const store = useJobsStore.getState();
    store.openFilters();
    store.setDraftPostedWithin('24h');
    store.toggleDraftEmploymentType('contract');
    store.toggleDraftExperience('senior');
    store.setDraftSort('recent');

    expect(useJobsStore.getState().filters.postedWithin).toBeUndefined();
    expect(useJobsStore.getState().sort).toBe('relevance');

    useJobsStore.getState().applyFilters();

    const applied = useJobsStore.getState();
    expect(applied.filters.postedWithin).toBe('24h');
    expect(applied.filters.employmentTypes).toEqual(['full_time', 'contract']);
    expect(applied.filters.experienceLevels).toEqual(['senior']);
    expect(applied.sort).toBe('recent');
    expect(applied.filtersOpen).toBe(false);
  });

  it('discards the draft on close and re-seeds on the next open', () => {
    const store = useJobsStore.getState();
    store.openFilters();
    store.toggleDraftRemote('onsite');
    store.closeFilters();

    expect(useJobsStore.getState().filters.remote).toEqual(REMOTE_FRIENDLY);

    useJobsStore.getState().openFilters();
    expect(useJobsStore.getState().draft?.filters.remote).toEqual(REMOTE_FRIENDLY);
  });

  it('resets the draft without committing it', () => {
    const store = useJobsStore.getState();
    store.openFilters();
    store.resetDraft();

    expect(appliedFilterChips(useJobsStore.getState().draft!.filters)).toEqual([]);
    // Reset pairs with Apply in the sticky bar, so the live list must not have moved yet.
    expect(appliedFilterChips(useJobsStore.getState().filters)).toHaveLength(3);
  });

  it('treats a thumb parked on an end stop as no bound at all', () => {
    const store = useJobsStore.getState();
    store.openFilters();
    store.setDraftSalary(SALARY_FILTER_MIN, SALARY_FILTER_MAX);

    expect(useJobsStore.getState().draft?.filters.salaryMin).toBeUndefined();
    expect(useJobsStore.getState().draft?.filters.salaryMax).toBeUndefined();

    useJobsStore.getState().setDraftSalary(2_000_000, 4_500_000);
    expect(useJobsStore.getState().draft?.filters.salaryMin).toBe(2_000_000);
    expect(useJobsStore.getState().draft?.filters.salaryMax).toBe(4_500_000);
  });

  it('"Any" clears the experience group rather than adding a level', () => {
    const store = useJobsStore.getState();
    store.openFilters();
    store.toggleDraftExperience('entry');
    store.toggleDraftExperience('lead');
    expect(useJobsStore.getState().draft?.filters.experienceLevels).toEqual(['entry', 'lead']);

    useJobsStore.getState().toggleDraftExperience(undefined);
    expect(useJobsStore.getState().draft?.filters.experienceLevels).toEqual([]);
  });
});
