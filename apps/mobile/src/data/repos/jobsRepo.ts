import { newId, simulate } from '@/data/mock';
import type { Application, Job, JobFilters, JobSort, PostedWithin } from '@/data/models';
import type { SalaryCurrency, SalaryRange } from '@/lib';

import { clone, findOrThrow, type MockStore } from './state';
import type { JobsRepo, Page } from './types';

export const JOBS_PAGE_SIZE = 20;

const HOUR = 60 * 60 * 1000;
const POSTED_WITHIN_MS: Record<PostedWithin, number> = {
  '24h': 24 * HOUR,
  '7d': 7 * 24 * HOUR,
  '30d': 30 * 24 * HOUR,
};

/**
 * Indicative rates so the ₹ salary slider can reach listings priced in another currency — the
 * comparison used to run on raw numbers in each listing's own units, which meant any ₹ band
 * silently excluded every USD/EUR/AUD role. Mock-layer only; the real API returns a normalised band.
 */
const TO_INR: Record<SalaryCurrency, number> = { INR: 1, USD: 88, EUR: 95, AUD: 57 };
const PERIODS_PER_YEAR: Record<SalaryRange['period'], number> = { year: 1, month: 12, hour: 2080 };

/** Annualised and converted to INR, the unit `JobFilters.salaryMin`/`salaryMax` are expressed in. */
const annualInr = (amount: number, salary: SalaryRange): number =>
  amount * TO_INR[salary.currency] * PERIODS_PER_YEAR[salary.period];

const salaryCeiling = (job: Job): number => {
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

const COMPARATORS: Record<JobSort, (a: Job, b: Job) => number> = {
  relevance: byRelevance,
  recent: byPostedDesc,
  salary: bySalaryDesc,
};

const normalise = (value: string): string => value.trim().toLowerCase();

export function matchesFilters(job: Job, filters: JobFilters, now = Date.now()): boolean {
  const query = normalise(filters.query ?? '');
  if (query) {
    const haystack = [job.title, job.company, job.location, ...job.tags].map(normalise);
    if (!haystack.some((field) => field.includes(query))) return false;
  }
  if (filters.locations.length > 0) {
    const location = normalise(job.location);
    if (!filters.locations.some((wanted) => location.includes(normalise(wanted)))) return false;
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

/** Cursor is a stringified offset; opaque to callers. */
const parseCursor = (cursor?: string): number => {
  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  return Number.isFinite(offset) && offset > 0 ? offset : 0;
};

export function createMockJobsRepo(store: MockStore): JobsRepo {
  const find = (id: string): Job => findOrThrow(store.state.jobs, id, 'Job');
  const emptyPage = (): Page<Job> => ({ items: [] });

  return {
    list: (filters, cursor, sort = 'relevance') =>
      simulate(
        () => {
          const offset = parseCursor(cursor);
          const matching = store.state.jobs
            .filter((job) => matchesFilters(job, filters))
            .sort(COMPARATORS[sort]);
          const items = matching.slice(offset, offset + JOBS_PAGE_SIZE);
          const end = offset + items.length;
          return clone({
            items,
            nextCursor: end < matching.length ? String(end) : undefined,
          });
        },
        { empty: emptyPage },
      ),

    // Powers the filter sheet's "Show N jobs" CTA, which previews a draft before it is applied.
    count: (filters) =>
      simulate(() => store.state.jobs.filter((job) => matchesFilters(job, filters)).length, {
        empty: () => 0,
      }),

    get: (id) => simulate(() => clone(find(id))),

    // "Similar jobs" on JOBS 05 (1:898): same-tag roles at other companies, best match first.
    listSimilar: (id, limit = 3) =>
      simulate(
        () => {
          const job = find(id);
          const tags = new Set(job.tags);
          const scored = store.state.jobs
            .filter((other) => other.id !== job.id && other.company !== job.company)
            .map((other) => ({
              job: other,
              shared: other.tags.filter((tag) => tags.has(tag)).length,
            }))
            .filter((entry) => entry.shared > 0)
            .sort(
              (a, b) =>
                b.shared - a.shared ||
                (b.job.matchScore ?? 0) - (a.job.matchScore ?? 0) ||
                byRelevance(a.job, b.job),
            );
          return clone(scored.slice(0, limit).map((entry) => entry.job));
        },
        { empty: () => [] },
      ),

    listSaved: () =>
      simulate(() => clone(store.state.jobs.filter((job) => job.isSaved).sort(bySavedDesc)), {
        empty: () => [],
      }),

    listApplications: () =>
      simulate(
        () =>
          clone(
            // Declaration order is the provider's ranking (see applicationsFixture): the
            // artboard leads with the actionable interview, not the newest submission.
            store.state.applications.flatMap((application) => {
                const job = store.state.jobs.find((item) => item.id === application.jobId);
                // An application whose listing has aged out of the catalogue is not renderable.
                return job ? [{ application, job }] : [];
              }),
          ),
        { empty: () => [] },
      ),

    toggleSave: (id) =>
      simulate(() => {
        const current = find(id);
        const updated: Job = { ...current, isSaved: !current.isSaved };
        store.state.jobs = store.state.jobs.map((job) => (job.id === id ? updated : job));
        return clone(updated);
      }),

    // NOTIF 07: "Apply now" submits for real ("Application sent to Stripe"), so the Applied
    // tab gains the row. Idempotent — re-applying returns the existing application.
    apply: (id) =>
      simulate(() => {
        find(id);
        const existing = store.state.applications.find((item) => item.jobId === id);
        if (existing) return clone(existing);
        const application: Application = {
          id: newId('app'),
          jobId: id,
          status: 'applied',
          appliedAt: new Date().toISOString(),
        };
        store.state.applications = [application, ...store.state.applications];
        return clone(application);
      }),

    // Jobs tab "Today's picks": editorial carousel, newest first.
    listTodaysPicks: () =>
      simulate(
        () => clone(store.state.jobs.filter((job) => job.isTodaysPick).sort(byPostedDesc)),
        { empty: () => [] },
      ),

    // Home "Top Job Matches": best match first, newest breaks ties.
    listPicks: () =>
      simulate(
        () =>
          clone(
            store.state.jobs
              .filter((job) => job.isPick)
              .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0) || byPostedDesc(a, b)),
          ),
        { empty: () => [] },
      ),
  };
}
