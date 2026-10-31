import { SAVED_JOB_COMPARATORS } from '../../jobs/filters';
import type { Application, ApplicationWithJob, Job } from '../../models/job';
import {
  applicationAskResultSchema,
  applicationAsksSchema,
  applicationListSchema,
  applicationSchema,
  jobCountSchema,
  jobFiltersToQuery,
  jobListSchema,
  jobPageSchema,
  jobSchema,
} from '../../schemas/job';
import type { JobsRepo, Page } from '../types';
import { newIdempotencyKey, type HttpClient } from './client';
import { isServerId } from './jdRepo';

/**
 * `JobsRepo` over `/api/v1/jobs` (ImBackendImplementationPlan P11-04, P11-05, P11-11). Search,
 * counts, picks, detail, similar, company, saved jobs and applications are served. Link import is
 * still listed here until the reader lands. A listing the server owns keeps its UUID; a job the
 * mock made (a link import) keeps its own id and stays in the mock library, and the saved list
 * shows both.
 */
export const JOBS_FALLBACKS = ['readLink', 'importFromLink'] as const satisfies readonly (keyof JobsRepo)[];

type Served = Exclude<keyof JobsRepo, (typeof JOBS_FALLBACKS)[number]>;

const job = (data: unknown) => jobSchema.parse(data) as Job;
const application = (data: unknown) => applicationSchema.parse(data) as Application;
const jobs = (data: unknown) => jobListSchema.parse(data).data as Job[];

export function createHttpJobsRepo(http: HttpClient, mock: JobsRepo): Pick<JobsRepo, Served> {
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
    async listApplications() {
      return applicationListSchema.parse(await http.request('/applications')).items as ApplicationWithJob[];
    },
    apply: async (id) => (isServerId(id) ? application(await http.request('/applications', { body: { jobId: id } })) : mock.apply(id)),
    updateApplicationStatus: async (id, status) => application(await http.request(`/applications/${id}`, { method: 'PATCH', body: { status } })),
    async askAboutApplication(target) {
      if ('jobId' in target && !isServerId(target.jobId)) return mock.askAboutApplication(target);
      return applicationAskResultSchema.parse(await http.request('/applications/asks', { body: target })).ask;
    },
    listApplicationAsks: async () => applicationAsksSchema.parse(await http.request('/applications/asks')).items,
    async answerApplicationAsk(id, answer) {
      await http.request(`/applications/asks/${id}/answer`, { body: { answer } });
    },
  };
}
