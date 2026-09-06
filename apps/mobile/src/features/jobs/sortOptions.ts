import {
  JOB_SORT_LABEL,
  SAVED_JOBS_SORT_LABEL,
  type Job,
  type JobSort,
  type SavedJobsSort,
} from '@/data/models';
import type { SalaryCurrency, SalaryRange } from '@/lib';
import type { SheetOption } from '@/ui/OptionSheet';

/** Either sort, as the one picker sheet sees a chosen key before it knows which list it came from. */
export type AnyJobSort = JobSort | SavedJobsSort;

const optionsFrom = <K extends string>(
  keys: readonly K[],
  labels: Record<K, string>,
): readonly SheetOption<K>[] => keys.map((key) => ({ key, label: labels[key] }));

/** Discover (Figma 1:326). Reading order is the union's, leading with the default. */
export const JOB_SORT_OPTIONS = optionsFrom<JobSort>(
  ['relevance', 'recent', 'salary'],
  JOB_SORT_LABEL,
);

/**
 * Saved. Not the same three: a saved job has no search left to be relevant to, so the default is
 * the order they were saved in and the deadline takes relevance's place (see SavedJobsSort).
 */
export const SAVED_JOBS_SORT_OPTIONS = optionsFrom<SavedJobsSort>(
  ['recent', 'closing', 'salary'],
  SAVED_JOBS_SORT_LABEL,
);

/**
 * The two unions overlap on 'recent' and 'salary', so a picked key is narrowed by the member each
 * list has to itself rather than by a cast.
 */
export const isSavedJobsSort = (key: AnyJobSort): key is SavedJobsSort => key !== 'relevance';
export const isJobSort = (key: AnyJobSort): key is JobSort => key !== 'closing';

/**
 * Mock-parity currency normalisation: `jobsRepo` annualises and converts the same way before
 * comparing, so a mixed-currency list orders by real value rather than by raw digits. Both copies
 * go the moment `useSavedJobs` takes a sort and `listSaved(sort)` does the ordering.
 */
const TO_INR: Record<SalaryCurrency, number> = { INR: 1, USD: 88, EUR: 95, AUD: 57 };
const PERIODS_PER_YEAR: Record<SalaryRange['period'], number> = { year: 1, month: 12, hour: 2080 };

/** A listing that quotes no salary scores 0, which is last in a descending order. */
const salaryCeiling = (job: Job): number => {
  const { salary } = job;
  if (!salary) return 0;
  const top = salary.max ?? salary.min;
  return top == null ? 0 : top * TO_INR[salary.currency] * PERIODS_PER_YEAR[salary.period];
};

/**
 * A deadline that does not exist sorts after every deadline that does — a posting with no closing
 * date is not closing, so it belongs at the end rather than where an empty string would put it.
 */
const NO_DEADLINE = '9999';

/** Saved before it was saved is impossible; `postedAt` only covers a fixture with no `savedAt`. */
const bySavedDesc = (a: Job, b: Job): number =>
  (b.savedAt ?? b.postedAt).localeCompare(a.savedAt ?? a.postedAt);

const byClosingAsc = (a: Job, b: Job): number =>
  (a.closingAt ?? NO_DEADLINE).localeCompare(b.closingAt ?? NO_DEADLINE);

const bySalaryDesc = (a: Job, b: Job): number => salaryCeiling(b) - salaryCeiling(a);

const SAVED_COMPARATORS: Record<SavedJobsSort, (a: Job, b: Job) => number> = {
  recent: bySavedDesc,
  closing: byClosingAsc,
  salary: bySalaryDesc,
};

/**
 * Orders the saved list. This belongs in the repo — `listSaved(sort)` already implements exactly
 * these three — but `useSavedJobs()` takes no argument yet, so the screen does it client-side.
 * Delete this the moment the hook passes a sort through.
 */
export function sortSavedJobs(jobs: readonly Job[], sort: SavedJobsSort): Job[] {
  return [...jobs].sort(SAVED_COMPARATORS[sort]);
}
