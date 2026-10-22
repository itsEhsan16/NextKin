import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { comparisonQuerySchema, jdCreateSchema, jdDraftSchema, jdMatchSchema, jdPatchSchema, tailorComparisonSchema } from '@nextkin/shared/schemas/jd';

import type { Database } from '../../db/database';
import { createJd, getJd, updateJd } from '../../services/jd';
import { jdMatch } from '../../services/jdMatch';
import { compareResumeToJd } from '../../services/tailorCompare';
import type { ApiEnv } from '../env';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * Job descriptions (spec §11 `/api/v1/jd`; ImBackendImplementationPlan P9-01). A paste or a scanned
 * upload starts an extraction the client awaits by polling; the user's corrections are stored
 * beside it and are what generation reads. No URL is fetched here (D-17).
 */

const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const idParam = z.object({ id: z.string().max(100) });

export function jdRoutes(db: Database): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();

  app.openapi(
    createRoute({
      method: 'post',
      path: '/jd',
      tags: ['jd'],
      summary: 'Read a pasted or uploaded job description. Poll it until it is ready.',
      request: { body: json(jdCreateSchema) },
      responses: { 202: ok('Extracting.', jdDraftSchema), 422: { description: 'The file cannot be read (UNREADABLE_FILE).' }, ...authErrors, ...notFoundError, ...commonErrors },
    }),
    async (c) => c.json(checked(jdDraftSchema, await createJd(db, requireAuth(c).identity, c.req.valid('json'), c.get('requestId'))), 202),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/jd/{id}', tags: ['jd'], summary: 'A job description: extracting, then the draft.', request: { params: idParam }, responses: { 200: ok('The draft.', jdDraftSchema), ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(jdDraftSchema, await getJd(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/jd/{id}',
      tags: ['jd'],
      summary: 'Correct what was read. Generation reads the corrected draft.',
      request: { params: idParam, body: json(jdPatchSchema) },
      responses: { 200: ok('The corrected draft.', jdDraftSchema), ...authErrors, ...notFoundError, ...commonErrors },
    }),
    async (c) => c.json(checked(jdDraftSchema, await updateJd(db, requireAuth(c).identity, c.req.valid('param').id, c.req.valid('json'))), 200),
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/jd/{id}/match',
      tags: ['jd'],
      summary: 'How the profile matches this job description: the listing match engine, no model call. Empty until there is something to score.',
      request: { params: idParam },
      responses: { 200: ok('The match.', jdMatchSchema), ...authErrors, ...notFoundError, ...commonErrors },
    }),
    async (c) => c.json(checked(jdMatchSchema, await jdMatch(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/jd/{id}/comparison',
      tags: ['jd'],
      summary: 'One of your resumes measured against this job description (W-TAILOR 01): the score, the keywords on and off it, what to improve. No model call.',
      request: { params: idParam, query: comparisonQuerySchema },
      responses: { 200: ok('The comparison.', tailorComparisonSchema), 409: { description: 'The JD is not ready (CONFLICT).' }, ...authErrors, ...notFoundError, ...commonErrors },
    }),
    async (c) => c.json(checked(tailorComparisonSchema, await compareResumeToJd(db, requireAuth(c).identity, c.req.valid('param').id, c.req.valid('query').resumeId)), 200),
  );

  return app;
}
