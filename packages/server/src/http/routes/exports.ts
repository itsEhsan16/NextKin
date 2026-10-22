import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { exportRequestSchema, exportStatusSchema } from '@nextkin/shared/schemas/resumeEdit';
import { resumePreviewSchema } from '@nextkin/shared/schemas/resumePreview';

import type { Database } from '../../db/database';
import { exportStatus, requestExport } from '../../services/exports';
import { resumePreview } from '../../services/renderPreview';
import type { StoragePort } from '../../storage/storage';
import type { ApiEnv } from '../env';
import { AppError } from '../errors';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * Exports (ImBackendImplementationPlan P10-07/08, C-07; V2 §7.12). POST asks for a file of the
 * current version; the worker renders it into the exports bucket, and GET hands out a presigned
 * URL that lasts at most 15 minutes. Refusals are typed: EXPORT_BLOCKED (with `details.reason`:
 * accuracy, review or email) and PLAN_LOCKED for DOCX on the free plan.
 */

export interface ExportRouteDeps {
  db: Database;
  documents?: { storage: StoragePort; exportsBucket: string };
}

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });

export function exportRoutes(deps: ExportRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const exportDeps = () => {
    if (!deps.documents) throw new AppError('UNAVAILABLE', 'Downloads are not available right now.');
    return { db: deps.db, storage: deps.documents.storage, bucket: deps.documents.exportsBucket };
  };

  app.openapi(
    createRoute({
      method: 'post',
      path: '/resumes/{id}/exports',
      tags: ['exports'],
      summary: 'Ask for a PDF, DOCX or TXT of the current version. Poll the export until it is ready.',
      request: { params: z.object({ id: z.string().uuid() }), body: { required: true, content: { 'application/json': { schema: exportRequestSchema } } } },
      responses: {
        202: ok('Rendering, or already rendered.', exportStatusSchema),
        402: { description: 'DOCX on the free plan (PLAN_LOCKED).' },
        409: { description: 'Blocked until the user acts (EXPORT_BLOCKED; details.reason is accuracy, review or email).' },
        ...authErrors,
        ...notFoundError,
        ...commonErrors,
      },
    }),
    async (c) => {
      const { format, template } = c.req.valid('json');
      return c.json(checked(exportStatusSchema, await requestExport(exportDeps(), requireAuth(c).identity, c.req.valid('param').id, format, template, c.get('requestId'))), 202);
    },
  );

  app.openapi(
    createRoute({ method: 'get', path: '/exports/{id}', tags: ['exports'], summary: 'An export: pending, or ready with a link valid for 15 minutes.', request: { params: z.object({ id: z.string().uuid() }) }, responses: { 200: ok('The export.', exportStatusSchema), ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(exportStatusSchema, await exportStatus(exportDeps(), requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/resumes/{id}/preview',
      tags: ['exports'],
      summary: 'The typeset pages of a version (default: the current one), as images valid for 15 minutes, and its PDF. Poll while pending.',
      request: { params: z.object({ id: z.string().uuid() }), query: z.object({ version: z.string().uuid().optional() }) },
      responses: { 200: ok('The pages, or pending, failed or structured.', resumePreviewSchema), ...authErrors, ...notFoundError, ...commonErrors },
    }),
    async (c) => c.json(checked(resumePreviewSchema, await resumePreview(exportDeps(), requireAuth(c).identity, c.req.valid('param').id, c.req.valid('query').version, c.get('requestId'))), 200),
  );

  return app;
}
