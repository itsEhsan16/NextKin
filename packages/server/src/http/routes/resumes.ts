import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  atsFixResultSchema,
  atsFixSchema,
  atsScorePanelSchema,
  documentContentSchema,
  documentCreateSchema,
  letterPatchSchema,
  renameSchema,
  restoreSchema,
  resumeCardSchema,
  resumeListSchema,
  resumeSectionKeySchema,
  lineSourceListSchema,
  resumeVersionListSchema,
  sectionRunSchema,
  sectionRegenerateSchema,
  sectionUpdateSchema,
  trashListSchema,
  zeroCheckResultSchema,
  zeroResolutionSchema,
} from '@nextkin/shared/schemas/resumeEdit';
import type { ZeroResolution } from '@nextkin/shared/models/zeroResume';

import type { IdempotencyStore } from '../../cache/stores';
import type { Database } from '../../db/database';
import * as content from '../../services/resumeContent';
import * as read from '../../services/resumeRead';
import * as library from '../../services/resumes';
import { sectionRunStatus, startSectionRun } from '../../services/sectionRuns';
import type { StoragePort } from '../../storage/storage';
import { etagFor } from '../etag';
import type { ApiEnv } from '../env';
import { AppError, errors } from '../errors';
import { idempotent, requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError, writeErrors } from './common';

/**
 * `/api/v1/resumes` (ImBackendImplementationPlan P10-01…P10-03, P10-13; V2 §7.9–§7.11, C-05). The
 * library and the editor: every `ResumesRepo` method the backend serves. Writes to the body may
 * carry If-Match with the ETag `GET …/content` returned. The trash routes are server-only until a
 * trash screen is designed; "delete" in the apps is permanent.
 */

export interface ResumeRouteDeps {
  db: Database;
  idempotency: IdempotencyStore;
  /** Storage for permanent deletes (files by reference). Without it, delete answers UNAVAILABLE. */
  documents?: { storage: StoragePort; exportsBucket: string };
}

const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const idParam = z.object({ id: z.string().uuid() });
const sectionParam = z.object({ id: z.string().uuid(), section: resumeSectionKeySchema });
const ifMatch = z.object({ 'if-match': z.string().optional() });
const errs = { ...authErrors, ...notFoundError, ...commonErrors };

export function resumeRoutes(deps: ResumeRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const { db } = deps;
  const withEtag = async (c: { header(name: string, value: string): void }, identity: Parameters<typeof read.resumeRowVersion>[1], id: string) =>
    c.header('ETag', etagFor(await read.resumeRowVersion(db, identity, id)));

  app.openapi(createRoute({ method: 'get', path: '/resumes', tags: ['resumes'], summary: 'The library, newest first.', responses: { 200: ok('Documents.', resumeListSchema), ...errs } }), async (c) =>
    c.json(checked(resumeListSchema, { data: await read.listResumes(db, requireAuth(c).identity) }), 200),
  );

  app.on('POST', '/resumes', idempotent(deps.idempotency, { required: false }));
  app.openapi(
    createRoute({ method: 'post', path: '/resumes', tags: ['resumes'], summary: 'Start an empty document to fill in by hand.', request: { body: json(documentCreateSchema) }, responses: { 201: ok('Created.', resumeCardSchema), ...writeErrors, ...errs } }),
    async (c) => c.json(checked(resumeCardSchema, await library.createDocument(db, requireAuth(c).identity, c.req.valid('json'))), 201),
  );

  app.openapi(createRoute({ method: 'get', path: '/resumes/{id}', tags: ['resumes'], summary: 'One document.', request: { params: idParam }, responses: { 200: ok('The document.', resumeCardSchema), ...errs } }), async (c) =>
    c.json(checked(resumeCardSchema, await read.getResume(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({ method: 'patch', path: '/resumes/{id}', tags: ['resumes'], summary: 'Rename.', request: { params: idParam, body: json(renameSchema) }, responses: { 200: ok('Renamed.', resumeCardSchema), ...errs } }),
    async (c) => c.json(checked(resumeCardSchema, await library.renameDocument(db, requireAuth(c).identity, c.req.valid('param').id, c.req.valid('json').title)), 200),
  );

  app.openapi(
    createRoute({ method: 'delete', path: '/resumes/{id}', tags: ['resumes'], summary: 'Delete permanently: the document, its versions and its exported files.', request: { params: idParam }, responses: { 204: { description: 'Deleted.' }, ...errs } }),
    async (c) => {
      if (!deps.documents) throw new AppError('UNAVAILABLE', 'Deleting documents is not available right now.');
      await library.removeDocument({ db, ...deps.documents }, requireAuth(c).identity, c.req.valid('param').id);
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/resumes/{id}/duplicate', tags: ['resumes'], summary: 'An independent copy at version 1.', request: { params: idParam }, responses: { 201: ok('The copy.', resumeCardSchema), ...errs } }),
    async (c) => c.json(checked(resumeCardSchema, await library.duplicateDocument(db, requireAuth(c).identity, c.req.valid('param').id)), 201),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/resumes/{id}/base', tags: ['resumes'], summary: 'Make this the base resume. Returns the whole library.', request: { params: idParam }, responses: { 200: ok('The library.', resumeListSchema), ...errs } }),
    async (c) => c.json(checked(resumeListSchema, { data: await library.setAsBase(db, requireAuth(c).identity, c.req.valid('param').id) }), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/resumes/{id}/confirm-accuracy', tags: ['resumes'], summary: 'Confirm the current version is accurate (once per version, before its first export).', request: { params: idParam }, responses: { 200: ok('Confirmed.', resumeCardSchema), ...errs } }),
    async (c) => c.json(checked(resumeCardSchema, await library.confirmAccuracy(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(createRoute({ method: 'get', path: '/resumes/{id}/score', tags: ['resumes'], summary: 'The current version’s score panel.', request: { params: idParam }, responses: { 200: ok('The panel.', atsScorePanelSchema), ...errs } }), async (c) =>
    c.json(checked(atsScorePanelSchema, await read.getScore(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/resumes/{id}/sources', tags: ['resumes'], summary: 'Where each line of the current version came from.', request: { params: idParam }, responses: { 200: ok('The lines and their sources.', lineSourceListSchema), ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(lineSourceListSchema, { data: await read.getLineSources(db, requireAuth(c).identity, c.req.valid('param').id) }), 200),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/resumes/{id}/versions', tags: ['resumes'], summary: 'Version history, newest first; beyond the plan’s cap, locked.', request: { params: idParam }, responses: { 200: ok('Versions.', resumeVersionListSchema), ...errs } }),
    async (c) => c.json(checked(resumeVersionListSchema, { data: await read.getVersions(db, requireAuth(c).identity, c.req.valid('param').id) }), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/resumes/{id}/restore', tags: ['resumes'], summary: 'Restore a version as a new current version.', request: { params: idParam, body: json(restoreSchema) }, responses: { 200: ok('Restored.', resumeCardSchema), 402: { description: 'A locked version (PLAN_LOCKED).' }, ...errs } }),
    async (c) => c.json(checked(resumeCardSchema, await content.restoreVersion(db, requireAuth(c).identity, c.req.valid('param').id, c.req.valid('json').versionId)), 200),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/resumes/{id}/content', tags: ['resumes'], summary: 'The current version’s body. ETag for If-Match on writes.', request: { params: idParam }, responses: { 200: ok('The body.', documentContentSchema), ...errs } }),
    async (c) => {
      const { identity } = requireAuth(c);
      const id = c.req.valid('param').id;
      const body = await read.getContent(db, identity, id);
      await withEtag(c, identity, id);
      return c.json(checked(documentContentSchema, body), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'put', path: '/resumes/{id}/sections/{section}', tags: ['resumes'], summary: 'Write one section; a new version, re-checked and re-scored.', request: { params: sectionParam, headers: ifMatch, body: json(sectionUpdateSchema) }, responses: { 200: ok('The body.', documentContentSchema), ...writeErrors, ...errs } }),
    async (c) => {
      const { identity } = requireAuth(c);
      const { id, section } = c.req.valid('param');
      const body = await content.updateSection(db, identity, id, section, c.req.valid('json').value, c.req.valid('header')['if-match']);
      await withEtag(c, identity, id);
      return c.json(checked(documentContentSchema, body), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'patch', path: '/resumes/{id}/letter', tags: ['resumes'], summary: 'Edit a cover letter’s body; a new version.', request: { params: idParam, headers: ifMatch, body: json(letterPatchSchema) }, responses: { 200: ok('The body.', documentContentSchema), ...writeErrors, ...errs } }),
    async (c) => {
      const { identity } = requireAuth(c);
      const id = c.req.valid('param').id;
      const body = await content.updateLetter(db, identity, id, c.req.valid('json'), c.req.valid('header')['if-match']);
      await withEtag(c, identity, id);
      return c.json(checked(documentContentSchema, body), 200);
    },
  );

  app.on('POST', '/resumes/:id/sections/:section/regenerate', idempotent(deps.idempotency, { required: true }));
  app.openapi(
    createRoute({
      method: 'post',
      path: '/resumes/{id}/sections/{section}/regenerate',
      tags: ['resumes'],
      summary: 'Regenerate one section on the worker. Requires Idempotency-Key; poll the run, then read the content.',
      request: {
        params: sectionParam,
        headers: z.object({ 'idempotency-key': z.string() }),
        // "AI rewrite" (toreview §113): how the user wants the section changed. Optional.
        body: { content: { 'application/json': { schema: sectionRegenerateSchema } }, required: false },
      },
      responses: { 202: ok('Started.', sectionRunSchema), ...writeErrors, ...errs },
    }),
    async (c) => {
      const { id, section } = c.req.valid('param');
      const body = (await c.req.json().catch(() => ({}))) as unknown;
      const parsed = sectionRegenerateSchema.safeParse(body ?? {});
      if (!parsed.success) throw errors.validation({ fields: ['instruction'] }, 'Say how to change it in 3 to 300 characters.');
      const run = await startSectionRun(db, requireAuth(c).identity, id, section, { idempotencyKey: c.req.valid('header')['idempotency-key'], correlationId: c.get('requestId'), ...(parsed.data.instruction ? { instruction: parsed.data.instruction } : {}) });
      return c.json(checked(sectionRunSchema, run), 202);
    },
  );

  app.openapi(
    createRoute({ method: 'get', path: '/resumes/{id}/regenerations/{runId}', tags: ['resumes'], summary: 'A section regeneration’s status.', request: { params: z.object({ id: z.string().uuid(), runId: z.string().uuid() }) }, responses: { 200: ok('The run.', sectionRunSchema), ...errs } }),
    async (c) => c.json(checked(sectionRunSchema, await sectionRunStatus(db, requireAuth(c).identity, c.req.valid('param').id, c.req.valid('param').runId)), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/resumes/{id}/fixes', tags: ['resumes'], summary: 'Apply one typed fix (a skill the profile backs) and re-score.', request: { params: idParam, body: json(atsFixSchema) }, responses: { 200: ok('Body and panel.', atsFixResultSchema), ...errs } }),
    async (c) => c.json(checked(atsFixResultSchema, await content.applyAtsFix(db, requireAuth(c).identity, c.req.valid('param').id, c.req.valid('json').itemId)), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/resumes/{id}/zero-check', tags: ['resumes'], summary: 'Answer one Zero Resume guess: edit, confirm or delete.', request: { params: idParam, body: json(zeroResolutionSchema) }, responses: { 200: ok('The draft after the answer.', zeroCheckResultSchema), 422: { description: 'A blank cannot stay (ZERO_BLANK).' }, ...errs } }),
    async (c) => c.json(checked(zeroCheckResultSchema, await content.resolveZeroCheck(db, requireAuth(c).identity, c.req.valid('param').id, c.req.valid('json') as ZeroResolution)), 200),
  );

  // Server-only until a trash screen is designed (P10-03).
  app.openapi(createRoute({ method: 'get', path: '/trash', tags: ['resumes'], summary: 'Trashed documents and when each is purged.', responses: { 200: ok('The trash.', trashListSchema), ...errs } }), async (c) =>
    c.json(checked(trashListSchema, { data: await library.listTrash(db, requireAuth(c).identity) }), 200),
  );
  app.openapi(createRoute({ method: 'post', path: '/resumes/{id}/trash', tags: ['resumes'], summary: 'Move to the 30-day trash.', request: { params: idParam }, responses: { 204: { description: 'Trashed.' }, ...errs } }), async (c) => {
    await library.trashDocument(db, requireAuth(c).identity, c.req.valid('param').id);
    return c.body(null, 204);
  });
  app.openapi(
    createRoute({ method: 'post', path: '/resumes/{id}/untrash', tags: ['resumes'], summary: 'Restore from the trash.', request: { params: idParam }, responses: { 200: ok('Restored.', resumeCardSchema), ...errs } }),
    async (c) => c.json(checked(resumeCardSchema, await library.restoreFromTrash(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  return app;
}
