import type { Job, JobFilters, JobSort, PostedWithin, SavedJobsSort } from '../models/job';
import type { SalaryCurrency, SalaryRange } from '../models/salary';

/**
 * Job search semantics (V2 §7.13; ImBackendImplementationPlan P11-05), shared by the mock data
 * layer and the backend so both answer a filter, a sort and a page the same way. Phone-safe and
 * mock-free: the server imports it directly.
 */

export const JOBS_PAGE_SIZE = 20;

const HOUR = 60 * 60 * 1000;
const POSTED_WITHIN_MS: Record<PostedWithin, number> = {
  '24h': 24 * HOUR,
  '7d': 7 * 24 * HOUR,
  '30d': 30 * 24 * HOUR,
};

/**
 * One pinned table of indicative rates, so the ₹ salary slider can reach listings priced in
 * another currency. A listing's own band is never converted for display; only the comparison
 * against the slider is. A currency-aware filter is X-12's (toreview §105.18).
 */
export const TO_INR: Record<SalaryCurrency, number> = {
  INR: 1,
  USD: 88,
  EUR: 95,
  AUD: 57,
};

export const PERIODS_PER_YEAR: Record<SalaryRange['period'], number> = {
  year: 1,
  month: 12,
  hour: 2080,
};

/** Annualised and converted to INR, the unit `JobFilters.salaryMin`/`salaryMax` are expressed in. */
export const annualInr = (amount: number, salary: SalaryRange): number =>
  amount * TO_INR[salary.currency] * PERIODS_PER_YEAR[salary.period];

export const salaryCeiling = (job: Pick<Job, 'salary'>): number => {
  const { salary } = job;
  if (!salary) return 0;
  const top = salary.max ?? salary.min;
  return top == null ? 0 : annualInr(top, salary);
};

const byPostedDesc = (a: Job, b: Job): number => b.postedAt.localeCompare(a.postedAt);
const byRelevance = (a: Job, b: Job): number => a.relevanceRank - b.relevanceRank;
const bySavedDesc = (a: Job, b: Job): number =>
  (b.savedAt ?? b.postedAt).localeCompare(a.savedAt ?? a.postedAt);
// Compared in INR so a mixed-currency catalogue sorts by real value, not by raw digits.
const bySalaryDesc = (a: Job, b: Job): number => salaryCeiling(b) - salaryCeiling(a);
// Soonest deadline first. A listing with no deadline is not closing, so it sorts to the end
// rather than to the front, which is where an empty string would put it.
const byClosingAsc = (a: Job, b: Job): number =>
  (a.closingAt ?? '9999').localeCompare(b.closingAt ?? '9999');

export const JOB_COMPARATORS: Record<JobSort, (a: Job, b: Job) => number> = {
  relevance: byRelevance,
  recent: byPostedDesc,
  salary: bySalaryDesc,
};

/** Saved has its own three (SavedJobsSort): there is no search to be relevant to once saved. */
export const SAVED_JOB_COMPARATORS: Record<SavedJobsSort, (a: Job, b: Job) => number> = {
  recent: bySavedDesc,
  closing: byClosingAsc,
  salary: bySalaryDesc,
};

const normalise = (value: string): string => value.trim().toLowerCase();

export function matchesFilters(job: Job, filters: JobFilters, now = Date.now()): boolean {
  // A job the user added from a link is theirs, not a listing: Saved holds it, search never does.
  if (job.sourceUrl) return false;
  // A listing past its deadline has left search. It stays reachable by id, for the applications
  // that point at it.
  if (job.closingAt && new Date(job.closingAt).getTime() < now) return false;
  const query = normalise(filters.query ?? '');
  if (query) {
    const haystack = [job.title, job.company, job.location, ...job.tags].map(normalise);
    if (!haystack.some((field) => field.includes(query))) return false;
  }
  if (filters.locations.length > 0) {
    const location = normalise(job.location);
    if (!filters.locations.some((wanted) => location.includes(normalise(wanted)))) return false;
  }
  if (filters.companies.length > 0) {
    const company = normalise(job.company);
    if (!filters.companies.some((wanted) => company === normalise(wanted))) return false;
  }
  if (filters.remote.length > 0 && !filters.remote.includes(job.remote)) return false;
  if (filters.employmentTypes.length > 0 && !filters.employmentTypes.includes(job.employmentType))
    return false;
  if (
    filters.experienceLevels.length > 0 &&
    !filters.experienceLevels.includes(job.experienceLevel)
  )
    return false;
  if (filters.salaryMin != null || filters.salaryMax != null) {
    const { salary } = job;
    const top = salary?.max ?? salary?.min;
    const bottom = salary?.min ?? salary?.max;
    // A listing that quotes no salary can't be shown to satisfy a salary band.
    if (!salary || top == null || bottom == null) return false;
    // Overlap, not containment: keep a listing whose band intersects the requested one.
    if (filters.salaryMin != null && annualInr(top, salary) < filters.salaryMin) return false;
    if (filters.salaryMax != null && annualInr(bottom, salary) > filters.salaryMax) return false;
  }
  if (filters.postedWithin) {
    const age = now - new Date(job.postedAt).getTime();
    if (age > POSTED_WITHIN_MS[filters.postedWithin]) return false;
  }
  if (filters.tags.length > 0) {
    const tags = job.tags.map(normalise);
    if (!filters.tags.some((tag) => tags.includes(normalise(tag)))) return false;
  }
  return true;
}

/**
 * `listSimilar`'s rule (JOBS 05 "Similar jobs"): same tags (as written), another company, never the
 * job itself or a link import; most shared tags first, then best match, then relevance.
 */
export function similarJobs(target: Job, candidates: readonly Job[], limit = 3): Job[] {
  const tags = new Set(target.tags);
  return candidates
    .filter((job) => job.id !== target.id && !job.sourceUrl && job.company !== target.company)
    .map((job) => ({ job, shared: job.tags.filter((tag) => tags.has(tag)).length }))
    .filter((entry) => entry.shared > 0)
    .sort(
      (a, b) =>
        b.shared - a.shared ||
        (b.job.matchScore ?? 0) - (a.job.matchScore ?? 0) ||
        a.job.relevanceRank - b.job.relevanceRank,
    )
    .slice(0, limit)
    .map((entry) => entry.job);
}
