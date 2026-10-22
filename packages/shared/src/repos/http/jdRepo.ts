import type { JdDraft } from '../../models/jd';
import type { Job } from '../../models/job';
import { jobSchema } from '../../schemas/job';
import type { AdoptedDocument } from '../adopt';
import { fetchDocument } from './serverDocs';
import type { TailorComparison } from '../../models/tailor';
import { figureDraftSchema, jdDraftSchema, jdMatchSchema, tailorComparisonSchema } from '../../schemas/jd';
import type { JdRepo } from '../types';
import { ApiError, type HttpClient } from './client';
import { poll, uploadFile, type FileUploader } from './uploads';

/**
 * `JdRepo` over HTTP (ImBackendImplementationPlan P9-01, P9-08, P11-11). A pasted or uploaded JD is
 * read on the server, as a job this repository awaits (near-synchronously, by polling), and a
 * listing the server serves gives its JD at once (`forJob`, `extract({source: 'job'})`). The tailor
 * comparison of server documents is the server's too (toreview §110): a listing is measured
 * through its JD. What stays on the mock is listed below: a link (until the server reads links),
 * and a comparison that names a mock document or listing. A draft keeps the id space it was made in.
 */
export const JD_FALLBACKS = ['extract:link', 'compare:from-mock-document'] as const;

const SERVER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isServerId = (id: string | undefined): id is string => typeof id === 'string' && SERVER_ID.test(id);

const parse = (data: unknown): JdDraft => jdDraftSchema.parse(data) as JdDraft;

export interface JdBridge {
  adoptJob: (job: Job) => void;
  adoptDocument: (doc: AdoptedDocument) => void;
}

export function createHttpJdRepo(
  http: HttpClient,
  uploader: FileUploader | undefined,
  mock: JdRepo,
  options: { everyMs?: number; timeoutMs?: number; bridge?: JdBridge } = {},
): Pick<JdRepo, 'extract' | 'get' | 'update' | 'forJob' | 'compare' | 'compareToJd' | 'match' | 'draftFigure'> {
  const fromListing = async (jobId: string, details?: object) => parse(await http.request('/jd', { body: { source: 'job', jobId, ...(details ? { details } : {}) } }));
  const compareOnServer = async (resumeId: string, jdId: string): Promise<TailorComparison> =>
    tailorComparisonSchema.parse(await http.request(`/jd/${jdId}/comparison?resumeId=${encodeURIComponent(resumeId)}`)) as TailorComparison;
  const awaitReady = async (draft: JdDraft) => {
    const done = await poll(async () => parse(await http.request(`/jd/${draft.id}`)), (d) => d.status !== 'extracting', { everyMs: options.everyMs ?? 800, timeoutMs: options.timeoutMs ?? 45_000 });
    // The draft stays: §7.5 lets the user enter its fields by hand (`details.jdId`).
    if (done.status === 'failed') throw new ApiError('UNREADABLE_FILE', done.error ?? 'We couldn’t read this job description.', 422, { jdId: done.id });
    return done;
  };
  return {
    async extract(input) {
      if (input.source === 'paste') {
        return awaitReady(parse(await http.request('/jd', { body: { source: 'paste', text: input.text, ...(input.details ? { details: input.details } : {}) } })));
      }
      if (input.source === 'file' && uploader) {
        const upload = await uploadFile(http, uploader, 'jd', input.file);
        return awaitReady(parse(await http.request('/jd', { body: { source: 'file', uploadId: upload.id, ...(input.details ? { details: input.details } : {}) } })));
      }
      if (input.source === 'job' && isServerId(input.jobId)) return fromListing(input.jobId, input.details);
      return mock.extract(input);
    },
    forJob: async (jobId) => (isServerId(jobId) ? fromListing(jobId) : mock.forJob(jobId)),
    async compare(resumeId, jobId) {
      // Both on the server: the listing's JD (made from it, no model call), then the server's measure.
      if (isServerId(jobId) && isServerId(resumeId)) return compareOnServer(resumeId, (await fromListing(jobId)).id);
      // A mock document or listing is compared on the mock; file the server's half there first.
      if (options.bridge && isServerId(jobId)) options.bridge.adoptJob(jobSchema.parse(await http.request(`/jobs/${jobId}`)) as Job);
      if (options.bridge && isServerId(resumeId)) options.bridge.adoptDocument(await fetchDocument(http, resumeId));
      return mock.compare(resumeId, jobId);
    },
    async compareToJd(resumeId, jdId) {
      if (isServerId(jdId) && isServerId(resumeId)) return compareOnServer(resumeId, jdId);
      if (options.bridge && isServerId(resumeId)) options.bridge.adoptDocument(await fetchDocument(http, resumeId));
      return mock.compareToJd(resumeId, jdId);
    },
    async draftFigure(resumeId, roleId, line, text) {
      if (!isServerId(resumeId)) return mock.draftFigure(resumeId, roleId, line, text);
      return figureDraftSchema.parse(await http.request('/tailor/figure-draft', { body: { resumeId, roleId, line } }));
    },
    async get(id) {
      return isServerId(id) ? parse(await http.request(`/jd/${id}`)) : mock.get(id);
    },
    async update(id, patch) {
      return isServerId(id) ? parse(await http.request(`/jd/${id}`, { method: 'PATCH', body: patch })) : mock.update(id, patch);
    },
    async match(jdId) {
      if (!isServerId(jdId)) return mock.match(jdId);
      const match = jdMatchSchema.parse(await http.request(`/jd/${jdId}/match`));
      return match.matchBasis ? match : null;
    },
  };
}
