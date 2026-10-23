import { newId, simulate } from '../mock';
import type { Application, Job } from '../models';
import {
  JOB_COMPARATORS,
  JOBS_PAGE_SIZE,
  matchesFilters,
  SAVED_JOB_COMPARATORS,
  similarJobs,
} from '../jobs/filters';

import { importJobLink, readJobLink } from './jobLinkRepo';
import { clone, findOrThrow, type MockStore, PlanLockedError } from './state';
import type { JobsRepo, Page } from './types';

// The search semantics live in ../jobs/filters, shared with the backend (P11-05).
export { JOBS_PAGE_SIZE, matchesFilters };

/** Reading a page is the JD extractor's job, so a link takes its latency band (jdRepo). */
const LINK_LATENCY = { minMs: 1200, maxMs: 2200 };

/** V2 §13.3: Free saves up to 10 jobs; Pro is unlimited. The server enforces the same cap. */
export const FREE_SAVED_JOBS = 10;

const byPostedDesc = (a: Job, b: Job): number => b.postedAt.localeCompare(a.postedAt);
const normalise = (value: string): string => value.trim().toLowerCase();

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
            .sort(JOB_COMPARATORS[sort]);
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
      simulate(() => clone(similarJobs(find(id), store.state.jobs, limit)), { empty: () => [] }),

    // Every open role at one employer — the company screen's listings section, newest first.
    listByCompany: (company) =>
      simulate(
        () =>
          clone(
            store.state.jobs
              .filter((job) => normalise(job.company) === normalise(company) && !job.sourceUrl)
              .sort(byPostedDesc),
          ),
        { empty: () => [] },
      ),

    listSaved: (sort = 'recent') =>
      simulate(
        () =>
          clone(store.state.jobs.filter((job) => job.isSaved).sort(SAVED_JOB_COMPARATORS[sort])),
        { empty: () => [] },
      ),

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

    // P11-04: idempotent. Saving a saved job, or unsaving one that is not, changes nothing. The
    // Free cap counts open listings only (an expired save stays and does not count), and saves
    // already above it stay (§13.5): only an 11th new save is refused.
    setSaved: (id, saved) =>
      simulate(() => {
        const current = find(id);
        if (current.isSaved === saved) return clone(current);
        if (saved && store.state.subscription.plan === 'free') {
          const now = Date.now();
          const open = store.state.jobs.filter(
            (job) =>
              job.isSaved &&
              !job.sourceUrl &&
              !(job.closingAt && new Date(job.closingAt).getTime() < now),
          ).length;
          if (open >= FREE_SAVED_JOBS) throw new PlanLockedError('Saving more than 10 jobs');
        }
        const updated: Job = saved
          ? { ...current, isSaved: true, savedAt: new Date().toISOString() }
          : (({ savedAt: _cleared, ...rest }) => ({ ...rest, isSaved: false }))(current);
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

    // The web Applications board's "Update Status" (332:467): the candidate records where an
    // application has got to. Nothing the employer sends moves it in the mock.
    updateApplicationStatus: (id, status) =>
      simulate(() => {
        const current = findOrThrow(store.state.applications, id, 'Application');
        const updated: Application = { ...current, status };
        store.state.applications = store.state.applications.map((item) =>
          item.id === id ? updated : item,
        );
        return clone(updated);
      }),

    // Jobs tab "Today's picks": editorial carousel, newest first.
    listTodaysPicks: () =>
      simulate(() => clone(store.state.jobs.filter((job) => job.isTodaysPick).sort(byPostedDesc)), {
        empty: () => [],
      }),

    // TAILOR 00c: the link is read like a JD (its own latency), and only kept on import.
    readLink: (url) => simulate(() => clone(readJobLink(store, url)), LINK_LATENCY),
    importFromLink: (url) => simulate(() => clone(importJobLink(store, url)), LINK_LATENCY),

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
