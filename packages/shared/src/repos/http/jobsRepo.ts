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
import { companyFromHost, linkHost, titleFromPath } from '../../mock/jobLink';
import type { JdRepo, JobsRepo, Page } from '../types';
import { newIdempotencyKey, type HttpClient } from './client';
import { isServerId } from './jdRepo';

/**
 * `JobsRepo` over `/api/v1/jobs` (ImBackendImplementationPlan P11-04, P11-05, P11-11). Search,
 * counts, picks, detail, similar, company, saved jobs and applications are served, and a link is
 * read on the server through its JD. A listing the server owns keeps its UUID.
 */
export const JOBS_FALLBACKS = [] as const satisfies readonly (keyof JobsRepo)[];

type Served = Exclude<keyof JobsRepo, (typeof JOBS_FALLBACKS)[number]>;

const job = (data: unknown) => jobSchema.parse(data) as Job;
const application = (data: unknown) => applicationSchema.parse(data) as Application;
const jobs = (data: unknown) => jobListSchema.parse(data).data as Job[];

export function createHttpJobsRepo(http: HttpClient, mock: JobsRepo, jd?: Pick<JdRepo, 'extract'>): Pick<JobsRepo, Served> {
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
    listSaved: async (sort = 'recent') => jobs(await http.request('/jobs/saved', { query: { sort } })),
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
    updateApplicationStatus: async (id, status, interviewAt) => application(await http.request(`/applications/${id}`, { method: 'PATCH', body: { status, ...(interviewAt === undefined ? {} : { interviewAt }) } })),
    checkInApplication: async (id) => application(await http.request(`/applications/${id}/check-in`, { method: 'POST' })),
    async askAboutApplication(target) {
      if ('jobId' in target && !isServerId(target.jobId)) return mock.askAboutApplication(target);
      return applicationAskResultSchema.parse(await http.request('/applications/asks', { body: target })).ask;
    },
    listApplicationAsks: async () => applicationAsksSchema.parse(await http.request('/applications/asks')).items,
    // Only the address is read here: nothing leaves the phone until the candidate says to use it.
    async readLink(url) {
      const host = linkHost(url);
      return { url, host, title: titleFromPath(url) ?? 'Job posting', company: companyFromHost(host) ?? host };
    },
    async importFromLink(url) {
      if (!jd) return mock.importFromLink(url);
      const draft = await jd.extract({ source: 'link', url });
      return job(await http.request(`/jd/${draft.id}/save`, { method: 'POST' }));
    },
    async answerApplicationAsk(id, answer) {
      await http.request(`/applications/asks/${id}/answer`, { body: { answer } });
    },
  };
}
