import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { jobsFixture } from '@/data/mock';
import type { Job } from '@/data/models';
import { JobSortSheetHost, useJobsStore, type JobsSegment } from '@/features/jobs';
import {
  JOB_SORT_OPTIONS,
  SAVED_JOBS_SORT_OPTIONS,
  sortSavedJobs,
} from '@/features/jobs/sortOptions';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const [seed] = jobsFixture;
if (!seed) throw new Error('jobsFixture is empty');

/** A saved job with only the fields a comparator reads varied. */
const savedJob = (id: string, over: Partial<Job>): Job => ({
  ...seed,
  id,
  isSaved: true,
  ...over,
});

const inr = (max: number) => ({ max, currency: 'INR', period: 'year' }) as const;
const ids = (jobs: readonly Job[]) => jobs.map((job) => job.id);

describe('sortOptions (the two sorts are different unions)', () => {
  it('offers Discover the JobSort union, in the union order', () => {
    expect(JOB_SORT_OPTIONS.map((option) => option.key)).toEqual(['relevance', 'recent', 'salary']);
    expect(JOB_SORT_OPTIONS.map((option) => option.label)).toEqual([
      'Relevance',
      'Most recent',
      'Salary',
    ]);
  });

  it('offers Saved the SavedJobsSort union instead — no relevance, plus the deadline', () => {
    expect(SAVED_JOBS_SORT_OPTIONS.map((option) => option.key)).toEqual([
      'recent',
      'closing',
      'salary',
    ]);
    expect(SAVED_JOBS_SORT_OPTIONS.map((option) => option.label)).toEqual([
      'Recently saved',
      'Closing soon',
      'Salary',
    ]);
    const savedKeys: readonly string[] = SAVED_JOBS_SORT_OPTIONS.map((option) => option.key);
    expect(savedKeys).not.toContain('relevance');
  });

  it('orders "Recently saved" by the save date, newest first', () => {
    const jobs = [
      savedJob('old', { savedAt: '2026-08-01T00:00:00.000Z' }),
      savedJob('new', { savedAt: '2026-09-01T00:00:00.000Z' }),
      savedJob('mid', { savedAt: '2026-08-20T00:00:00.000Z' }),
    ];

    expect(ids(sortSavedJobs(jobs, 'recent'))).toEqual(['new', 'mid', 'old']);
    // Pure: the input list is not reordered under the caller.
    expect(ids(jobs)).toEqual(['old', 'new', 'mid']);
  });

  it('orders "Closing soon" by the deadline, and parks jobs without one at the end', () => {
    const jobs = [
      savedJob('none', { closingAt: undefined }),
      savedJob('later', { closingAt: '2026-10-01T00:00:00.000Z' }),
      savedJob('soon', { closingAt: '2026-09-08T00:00:00.000Z' }),
    ];

    expect(ids(sortSavedJobs(jobs, 'closing'))).toEqual(['soon', 'later', 'none']);
  });

  it('orders Salary by the top of the band, and parks unsalaried listings at the end', () => {
    const jobs = [
      savedJob('mid', { salary: inr(3_200_000) }),
      savedJob('unlisted', { salary: undefined }),
      savedJob('top', { salary: inr(4_800_000) }),
    ];

    expect(ids(sortSavedJobs(jobs, 'salary'))).toEqual(['top', 'mid', 'unlisted']);
  });

  it('compares a mixed-currency list by real value, not by raw digits', () => {
    const jobs = [
      savedJob('inr', { salary: { max: 6_000_000, currency: 'INR', period: 'year' } }),
      savedJob('usd', { salary: { max: 230_000, currency: 'USD', period: 'year' } }),
    ];

    // ₹60L is a smaller number than $230k is a bigger salary.
    expect(ids(sortSavedJobs(jobs, 'salary'))).toEqual(['usd', 'inr']);
  });
});

const INITIAL = useJobsStore.getState();

async function renderSheet(segment: JobsSegment) {
  useJobsStore.setState({ segment, sortOpen: true });
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <JobSortSheetHost />
    </SafeAreaProvider>,
  );
}

const press = (label: string) =>
  act(
    async () => void fireEvent.press(screen.getByLabelText(label, { includeHiddenElements: true })),
  );

const shows = (label: string) =>
  screen.queryByLabelText(label, { includeHiddenElements: true }) !== null;

describe('JobSortSheetHost', () => {
  beforeEach(() => {
    useJobsStore.setState(INITIAL, true);
  });

  afterEach(async () => {
    await cleanup();
  });

  it('offers Discover the three JobSort options and writes the picked one', async () => {
    await renderSheet('discover');

    expect(shows('Relevance')).toBe(true);
    expect(shows('Most recent')).toBe(true);
    expect(shows('Salary')).toBe(true);
    // Saved's deadline sort is not a Discover option.
    expect(shows('Closing soon')).toBe(false);

    await press('Most recent');

    expect(useJobsStore.getState().sort).toBe('recent');
    // The Saved order is untouched: the two sorts are stored apart.
    expect(useJobsStore.getState().savedSort).toBe('recent');
    expect(useJobsStore.getState().sortOpen).toBe(false);
  });

  it('offers Saved its own three and writes savedSort instead', async () => {
    await renderSheet('saved');

    expect(shows('Recently saved')).toBe(true);
    expect(shows('Closing soon')).toBe(true);
    expect(shows('Salary')).toBe(true);
    // Nothing is left to be relevant to once a job is saved.
    expect(shows('Relevance')).toBe(false);

    await press('Closing soon');

    expect(useJobsStore.getState().savedSort).toBe('closing');
    expect(useJobsStore.getState().sort).toBe('relevance');
    expect(useJobsStore.getState().sortOpen).toBe(false);
  });

  it('renders nothing on Applied, which has no sort control', async () => {
    await renderSheet('applied');

    expect(shows('Relevance')).toBe(false);
    expect(shows('Recently saved')).toBe(false);
    expect(shows('Salary')).toBe(false);
  });
});
