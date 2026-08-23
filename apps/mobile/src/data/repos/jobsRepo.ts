import { simulate } from '@/data/mock';
import type { Job, JobFilters, JobSort, PostedWithin } from '@/data/models';

import { clone, findOrThrow, type MockStore } from './state';
import type { JobsRepo, Page } from './types';

export const JOBS_PAGE_SIZE = 20;

const HOUR = 60 * 60 * 1000;
const POSTED_WITHIN_MS: Record<PostedWithin, number> = {
  '24h': 24 * HOUR,
  '7d': 7 * 24 * HOUR,
  '30d': 30 * 24 * HOUR,
};

const byPostedDesc = (a: Job, b: Job): number => b.postedAt.localeCompare(a.postedAt);
const byRelevance = (a: Job, b: Job): number => a.relevanceRank - b.relevanceRank;
const bySavedDesc = (a: Job, b: Job): number =>
  (b.savedAt ?? b.postedAt).localeCompare(a.savedAt ?? a.postedAt);
const bySalaryDesc = (a: Job, b: Job): number => (b.salary?.max ?? 0) - (a.salary?.max ?? 0);

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
  if (filters.salaryMin != null) {
    const upper = job.salary?.max ?? job.salary?.min;
    if (upper == null || upper < filters.salaryMin) return false;
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

    get: (id) => simulate(() => clone(find(id))),

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
