import { SAVED_JOB_COMPARATORS } from '../../jobs/filters';
import type { Job } from '../../models/job';
import { jobCountSchema, jobFiltersToQuery, jobListSchema, jobPageSchema, jobSchema } from '../../schemas/job';
import type { JobsRepo, Page } from '../types';
import { newIdempotencyKey, type HttpClient } from './client';
import { isServerId } from './jdRepo';

/**
 * `JobsRepo` over `/api/v1/jobs` (ImBackendImplementationPlan P11-04, P11-05, P11-11). Search,
 * counts, picks, detail, similar, company and saved jobs are served. Five methods stay on the mock
 * for good in Release 1 and are listed: applications (D-05) and link import (D-17, the server never
 * fetches a URL a user gives). A listing the server owns keeps its UUID; a job the mock made (a
 * link import) keeps its own id and stays in the mock library, and the saved list shows both.
 * Applying to a server listing first copies it into the mock store, where the mock looks it up.
 */
export const JOBS_FALLBACKS = ['apply', 'listApplications', 'updateApplicationStatus', 'readLink', 'importFromLink'] as const satisfies readonly (keyof JobsRepo)[];

type Served = Exclude<keyof JobsRepo, (typeof JOBS_FALLBACKS)[number]>;

const job = (data: unknown) => jobSchema.parse(data) as Job;
const jobs = (data: unknown) => jobListSchema.parse(data).data as Job[];

export function createHttpJobsRepo(http: HttpClient, mock: JobsRepo, adoptJob: (job: Job) => void): Pick<JobsRepo, Served | 'apply'> {
  const get = async (id: string): Promise<Job> => (isServerId(id) ? job(await http.request(`/jobs/${id}`)) : mock.get(id));
  return {
    async list(filters, cursor, sort = 'relevance') {
      const page = jobPageSchema.parse(await http.request('/jobs/search', { query: { ...jobFiltersToQuery(filters), sort, ...(cursor ? { cursor } : {}) } }));
      return page as Page<Job>;
    },
    async count(filters) {
      return jobCountSchema.parse(await http.request('/jobs/count', { query: jobFiltersToQuery(filters) })).count;
    },
    listTodaysPicks: async () => jobs(await http.request('/jobs/todays-picks')),
    listPicks: async () => jobs(await http.request('/jobs/picks')),
    get,
    listSimilar: async (id, limit = 3) => (isServerId(id) ? jobs(await http.request(`/jobs/${id}/similar`, { query: { limit } })) : mock.listSimilar(id, limit)),
    listByCompany: async (company) => jobs(await http.request('/jobs/by-company', { query: { company } })),
    async listSaved(sort = 'recent') {
      const server = jobs(await http.request('/jobs/saved', { query: { sort } }));
      // A job saved from a copied link is the app's own record (D-17): merged in, the order kept.
      const imported = (await mock.listSaved(sort)).filter((j) => j.sourceUrl && !isServerId(j.id));
      return [...server, ...imported].sort(SAVED_JOB_COMPARATORS[sort]);
    },
    async setSaved(id, saved) {
      if (!isServerId(id)) return mock.setSaved(id, saved);
      return saved
        ? job(await http.request('/jobs/saved', { method: 'POST', body: { jobId: id }, idempotencyKey: newIdempotencyKey() }))
        : job(await http.request(`/jobs/saved/${id}`, { method: 'DELETE' }));
    },
    async apply(id) {
      // Applications stay on the mock (D-05); it finds the job in its own store, so a server
      // listing is filed there first under its server id.
      if (isServerId(id)) adoptJob(await get(id));
      return mock.apply(id);
    },
  };
}
