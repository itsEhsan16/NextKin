import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { resumeFitSchema } from '@nextkin/shared/schemas/resumeFit';

import type { KvCache } from '../../cache/kv';
import type { Database } from '../../db/database';
import { fitStatus, requestFit } from '../../services/resumeFit';
import type { ApiEnv } from '../env';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * "Fit to one page" (toreview §113): POST asks the worker to fit the current version on one
 * typeset page, dropping whole bullets only if it must; GET is the outcome, kept for an hour.
 */

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const idParam = z.object({ id: z.string().uuid() });

export function fitRoutes(deps: { db: Database; kv: KvCache }): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();

  app.openapi(
    createRoute({ method: 'post', path: '/resumes/{id}/fit', tags: ['resumes'], summary: 'Fit the current version on one page, on the worker. Poll the fit.', request: { params: idParam }, responses: { 202: ok('Fitting.', resumeFitSchema), ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(resumeFitSchema, await requestFit(deps.db, deps.kv, requireAuth(c).identity, c.req.valid('param').id, c.get('requestId'))), 202),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/resumes/{id}/fit/{runId}', tags: ['resumes'], summary: 'A fit: running, done, or failed with its reason.', request: { params: idParam.extend({ runId: z.string().uuid() }) }, responses: { 200: ok('The fit.', resumeFitSchema), ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => {
      const { id, runId } = c.req.valid('param');
      return c.json(checked(resumeFitSchema, { id: runId, ...(await fitStatus(deps.kv, requireAuth(c).identity, id, runId)) }), 200);
    },
  );
  return app;
}
