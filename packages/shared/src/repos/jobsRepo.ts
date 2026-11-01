import { newId, simulate } from '../mock';
import type { Application, ApplicationAsk, ApplicationTarget, Job } from '../models';
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

/** How many times "Did you apply?" is asked, and how long "not yet" waits. */
const ASKS = 2;
const ASK_AGAIN_MS = 24 * 60 * 60 * 1000;

const pickAsk = ({ id, jobId, title, company }: ApplicationAsk): ApplicationAsk => ({ id, jobId, title, company });

export function createMockJobsRepo(store: MockStore): JobsRepo {
  const find = (id: string): Job => findOrThrow(store.state.jobs, id, 'Job');
  const emptyPage = (): Page<Job> => ({ items: [] });

  const recordApplied = (id: string): Application => {
    find(id);
    const existing = store.state.applications.find((item) => item.jobId === id);
    if (existing) return existing;
    const application: Application = { id: newId('app'), jobId: id, status: 'applied', appliedAt: new Date().toISOString() };
    store.state.applications = [application, ...store.state.applications];
    return application;
  };

  /** The job an ask is about: named, or the one whose company and role a resume targets. */
  const askedJob = (target: ApplicationTarget): Job | undefined => {
    if ('jobId' in target) return find(target.jobId);
    const resume = store.state.resumes.find((item) => item.id === target.resumeId);
    if (!resume?.targetCompany) return undefined;
    const company = normalise(resume.targetCompany);
    return store.state.jobs.find((job) => normalise(job.company) === company);
  };

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

    // The candidate says they applied, so the Applied tab gains the row. NextKin submits nothing.
    // Idempotent: re-applying returns the existing application.
    apply: (id) => simulate(() => clone(recordApplied(id))),

    // "Did you apply?" (owner, 2026-10-31). A job with an application, or a resume with no job
    // behind it, asks nothing; a second ask for the same job does not restart the count.
    askAboutApplication: (target) =>
      simulate(() => {
        const job = askedJob(target);
        if (!job) return null;
        if (store.state.applications.some((item) => item.jobId === job.id)) return null;
        const open = store.state.applicationAsks.find((item) => item.jobId === job.id);
        if (open) return open.asksLeft === ASKS ? clone(pickAsk(open)) : null;
        const ask = {
          id: newId('ask'),
          jobId: job.id,
          title: job.title,
          company: job.company,
          dueAt: new Date().toISOString(),
          asksLeft: ASKS,
        };
        store.state.applicationAsks = [...store.state.applicationAsks, ask];
        return clone(pickAsk(ask));
      }),

    listApplicationAsks: () =>
      simulate(
        () => {
          const now = Date.now();
          return store.state.applicationAsks
            .filter((ask) => ask.asksLeft > 0 && new Date(ask.dueAt).getTime() <= now)
            .map(pickAsk);
        },
        { empty: () => [] },
      ),

    answerApplicationAsk: (id, answer) =>
      simulate(() => {
        const ask = findOrThrow(store.state.applicationAsks, id, 'Application ask');
        if (answer === 'yes') recordApplied(ask.jobId);
        const later = answer === 'not_yet' && ask.asksLeft > 1;
        store.state.applicationAsks = later
          ? store.state.applicationAsks.map((item) =>
              item.id === id
                ? { ...item, asksLeft: item.asksLeft - 1, dueAt: new Date(Date.now() + ASK_AGAIN_MS).toISOString() }
                : item,
            )
          : store.state.applicationAsks.filter((item) => item.id !== id);
      }),

    // The web Applications board's "Update Status" (332:467): the candidate records where an
    // application has got to. Nothing the employer sends moves it in the mock.
    updateApplicationStatus: (id, status, interviewAt) =>
      simulate(() => {
        const current = findOrThrow(store.state.applications, id, 'Application');
        const { interviewAt: held, ...rest } = current;
        const day = status !== 'interview' ? null : interviewAt === undefined ? held : interviewAt;
        const updated: Application = {
          ...rest,
          status,
          checkedAt: new Date().toISOString(),
          ...(day ? { interviewAt: day } : {}),
        };
        store.state.applications = store.state.applications.map((item) =>
          item.id === id ? updated : item,
        );
        return clone(updated);
      }),

    checkInApplication: (id) =>
      simulate(() => {
        const current = findOrThrow(store.state.applications, id, 'Application');
        const updated: Application = { ...current, checkedAt: new Date().toISOString() };
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
