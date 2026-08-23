import { EMPLOYMENT_TYPE_LABEL } from '@/data/models';
import { appliedFilterChips, useJobsStore } from '@/features/jobs';

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
    useJobsStore.getState().removeFilter('salaryMin');
    expect(useJobsStore.getState().filters.salaryMin).toBeUndefined();
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
});
