import type { AtsScore, Resume, ResumeVersion } from '../../models/resume';
import type { DocumentContent, ResumeSectionKey } from '../../models/resumeContent';
import type { ResumeDocument } from '../../models/resumeDocument';
import type { ZeroCheckResult } from '../../models/zeroResume';
import { atsFixResultSchema, documentContentSchema, exportStatusSchema, resumeCardSchema, resumeListSchema, resumeVersionListSchema, sectionRunSchema, zeroCheckResultSchema } from '../../schemas/resumeEdit';
import { resumeDocumentSchema } from '../../schemas/resumeDocument';
import { resumeFitSchema } from '../../schemas/resumeFit';
import { resumePreviewSchema } from '../../schemas/resumePreview';
import { shareLinkSchema } from '../../schemas/sharedReport';
import { seededResumeIds } from '../state';
import type { ResumeExport, ResumesRepo } from '../types';
import { ApiError, newIdempotencyKey, type HttpClient } from './client';
import { isServerId } from './jdRepo';
import { parseResume, uploadFile, type FileUploader } from './uploads';

/**
 * `ResumesRepo` over `/api/v1/resumes` (ImBackendImplementationPlan P10-13, C-06). The library, the
 * editor and export are served. A document keeps the id space it was made in: a server document
 * (UUID) goes to the server, an upload's included (toreview §110.4); one the mock still makes (a run
 * on a mock document) stays in the mock library, and `list` shows both.
 *
 * - Body writes carry If-Match with the content ETag; on 412/428 the repo reloads and re-sends once.
 *   A section write replaces only that section on the server, so re-applying it on fresh content
 *   cannot drop a change made elsewhere to another section.
 * - `regenerateSection` and `export` are jobs on the worker; the repo awaits them by polling, so
 *   the interface stays a single promise.
 * - `export` returns a presigned URL (C-07) that lasts at most 15 minutes.
 * - `shareLink` makes a new view-only link to the document's ATS report, redacted (P11-10).
 */
export const RESUMES_FALLBACKS = [] as const satisfies readonly (keyof ResumesRepo)[];

type Served = Exclude<keyof ResumesRepo, (typeof RESUMES_FALLBACKS)[number]>;

const card = (data: unknown) => resumeCardSchema.parse(data) as unknown as Resume;
const body = (data: unknown) => documentContentSchema.parse(data) as unknown as DocumentContent;
const editorDocument = (data: unknown) => resumeDocumentSchema.parse(data) as ResumeDocument;

export interface HttpResumesOptions {
  /** How often the repo polls a section run or an export (tests shorten it). */
  everyMs?: number;
  /** How long it waits before giving up on one. */
  timeoutMs?: number;
}

export function createHttpResumesRepo(http: HttpClient, uploader: FileUploader, mock: ResumesRepo, options: HttpResumesOptions = {}): Pick<ResumesRepo, Served> & { reset(): void } {
  const etags = new Map<string, string>();
  const everyMs = options.everyMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 180_000;

  const loadContent = async (id: string) => {
    const result = await http.send(`/resumes/${id}/content`);
    if (result.etag) etags.set(id, result.etag);
    return body(result.data);
  };

  /** A conditional body write: If-Match from the last read; once more on fresh data if it was stale. */
  const writeBody = async (id: string, path: string, method: 'PUT' | 'PATCH', payload: unknown): Promise<DocumentContent> => {
    const attempt = async () => {
      const etag = etags.get(id);
      const result = await http.send(path, { method, body: payload, ...(etag ? { headers: { 'if-match': etag } } : {}) });
      if (result.etag) etags.set(id, result.etag);
      return body(result.data);
    };
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof ApiError) || (error.code !== 'PRECONDITION_FAILED' && error.code !== 'PRECONDITION_REQUIRED')) throw error;
      await loadContent(id);
      return attempt();
    }
  };

  const awaitJob = async <T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = await read();
      if (done(value)) return value;
      if (Date.now() > deadline) throw new ApiError('UNAVAILABLE', 'This is taking longer than it should. Try again in a moment.', 503);
      await new Promise((resolve) => setTimeout(resolve, everyMs));
    }
  };

  /** A section run on the worker, awaited, then the content it wrote; with "AI rewrite"'s request. */
  const runSection = async (id: string, section: ResumeSectionKey, instruction?: string) => {
    const started = sectionRunSchema.parse(
      await http.request(`/resumes/${id}/sections/${section}/regenerate`, { method: 'POST', idempotencyKey: newIdempotencyKey(), ...(instruction ? { body: { instruction } } : {}) }),
    );
    const run = await awaitJob(
      async () => sectionRunSchema.parse(await http.request(`/resumes/${id}/regenerations/${started.id}`)),
      (r) => r.status !== 'running',
    );
    if (run.status === 'failed') throw new ApiError('UNAVAILABLE', run.message ?? 'We could not regenerate that section.', 503);
    return loadContent(id);
  };

  return {
    reset: () => etags.clear(),

    async list() {
      const server = (resumeListSchema.parse(await http.request('/resumes')).data as unknown as Resume[]);
      // The mock library may hold copies of server documents (a finished run's, P9-08); the server's
      // win. Its seeded examples are not the user's, so they never join a served library.
      const seeded = seededResumeIds();
      const local = (await mock.list()).filter((r) => !isServerId(r.id) && !seeded.has(r.id));
      return [...server, ...local];
    },
    get: async (id) => (isServerId(id) ? card(await http.request(`/resumes/${id}`)) : mock.get(id)),
    create: async (input) => card(await http.request('/resumes', { method: 'POST', body: input, idempotencyKey: newIdempotencyKey() })),
    getScore: async (id) => (isServerId(id) ? ((await http.request(`/resumes/${id}/score`)) as AtsScore) : mock.getScore(id)),
    getVersions: async (id) => (isServerId(id) ? (resumeVersionListSchema.parse(await http.request(`/resumes/${id}/versions`)).data as ResumeVersion[]) : mock.getVersions(id)),
    getContent: async (id) => (isServerId(id) ? loadContent(id) : mock.getContent(id)),
    updateSection: async (id, section, value) => (isServerId(id) ? writeBody(id, `/resumes/${id}/sections/${section}`, 'PUT', { value }) : mock.updateSection(id, section, value)),
    getDocument: async (id) => (isServerId(id) ? editorDocument(await http.request(`/resumes/${id}/document`)) : mock.getDocument(id)),
    // Never re-sent on a conflict: the editor shows it, so a save cannot write over newer work.
    saveDocument: async (id, document, baseRevision) =>
      isServerId(id) ? editorDocument(await http.request(`/resumes/${id}/document`, { method: 'PUT', body: { document, baseRevision } })) : mock.saveDocument(id, document, baseRevision),
    updateLetter: async (id, patch) => (isServerId(id) ? writeBody(id, `/resumes/${id}/letter`, 'PATCH', patch) : mock.updateLetter(id, patch)),

    regenerateSection: async (id, section) => (isServerId(id) ? runSection(id, section) : mock.regenerateSection(id, section)),
    async fitToOnePage(id) {
      if (!isServerId(id)) return mock.fitToOnePage(id);
      const started = resumeFitSchema.parse(await http.request(`/resumes/${id}/fit`, { method: 'POST' }));
      if (started.status !== 'running' || !started.id) return started;
      return awaitJob(async () => resumeFitSchema.parse(await http.request(`/resumes/${id}/fit/${started.id}`)), (r) => r.status !== 'running');
    },
    rewriteSection: async (id, section, instruction) => (isServerId(id) ? runSection(id, section, instruction) : mock.rewriteSection(id, section, instruction)),

    async applyAtsFix(id, itemId) {
      if (!isServerId(id)) return mock.applyAtsFix(id, itemId);
      const result = atsFixResultSchema.parse(await http.request(`/resumes/${id}/fixes`, { method: 'POST', body: { itemId } }));
      return { content: result.content as unknown as DocumentContent, score: result.score as unknown as AtsScore };
    },
    restoreVersion: async (id, versionId) => (isServerId(id) ? card(await http.request(`/resumes/${id}/restore`, { method: 'POST', body: { versionId } })) : mock.restoreVersion(id, versionId)),
    resolveZeroCheck: async (id, resolution) =>
      isServerId(id) ? (zeroCheckResultSchema.parse(await http.request(`/resumes/${id}/zero-check`, { method: 'POST', body: resolution })) as unknown as ZeroCheckResult) : mock.resolveZeroCheck(id, resolution),
    duplicate: async (id) => (isServerId(id) ? card(await http.request(`/resumes/${id}/duplicate`, { method: 'POST' })) : mock.duplicate(id)),
    rename: async (id, title) => (isServerId(id) ? card(await http.request(`/resumes/${id}`, { method: 'PATCH', body: { title } })) : mock.rename(id, title)),

    async setAsBase(id) {
      if (!isServerId(id)) return [...(await mock.setAsBase(id)), ...(await this.list()).filter((r) => isServerId(r.id))];
      const server = resumeListSchema.parse(await http.request(`/resumes/${id}/base`, { method: 'POST' })).data as unknown as Resume[];
      return [...server, ...(await mock.list()).filter((r) => !isServerId(r.id))];
    },
    confirmAccuracy: async (id) => (isServerId(id) ? card(await http.request(`/resumes/${id}/confirm-accuracy`, { method: 'POST' })) : mock.confirmAccuracy(id)),

    async export(id, format): Promise<ResumeExport> {
      if (!isServerId(id)) return mock.export(id, format);
      const first = exportStatusSchema.parse(await http.request(`/resumes/${id}/exports`, { method: 'POST', body: { format } }));
      const done = await awaitJob(
        async () => (first.status === 'pending' ? exportStatusSchema.parse(await http.request(`/exports/${first.id}`)) : first),
        (e) => e.status !== 'pending',
      );
      if (done.status === 'failed' || !done.url || !done.expiresAt) throw new ApiError('UNAVAILABLE', done.message ?? 'We could not make that file. Try again.', 503);
      return { delivery: 'file', format: done.format, fileName: done.fileName, mimeType: done.mimeType, url: done.url, expiresAt: done.expiresAt };
    },

    async preview(id, versionId) {
      if (!isServerId(id)) return mock.preview(id, versionId);
      return resumePreviewSchema.parse(await http.request(`/resumes/${id}/preview${versionId ? `?version=${encodeURIComponent(versionId)}` : ''}`));
    },

    async shareLink(id) {
      if (!isServerId(id)) return mock.shareLink(id);
      return shareLinkSchema.parse(await http.request(`/resumes/${id}/share`, { body: {} })).url;
    },
    async remove(id) {
      if (!isServerId(id)) return mock.remove(id);
      await http.request(`/resumes/${id}`, { method: 'DELETE' });
      etags.delete(id);
    },

    async importFromFile(file) {
      // The file is read on the server (P7), and what it states, line for line, becomes a library
      // resume there (toreview §110.4): the one the tailor dialog then compares with a job.
      const upload = await uploadFile(http, uploader, 'resume', file);
      const parse = await parseResume(http, upload.id);
      const resume = card(await http.request(`/resume-parse/${parse.id}/resume`, { method: 'POST' }));
      return { resume, draft: parse.draft ?? {} };
    },
  };
}
