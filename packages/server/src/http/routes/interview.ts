import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { interviewMarkBodySchema, interviewSetListSchema, interviewSetOrNullSchema, interviewSetSchema } from '@nextkin/shared/schemas/interview';

import type { Database } from '../../db/database';
import * as interview from '../../services/interview';
import type { ApiEnv } from '../env';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * `/api/v1/interview/question-sets` (spec §11; ImBackendImplementationPlan P11-08). A set is made by
 * `POST /generations {kind: 'interview'}`; these routes read it back and keep the practice marks,
 * which persist across sessions (§7.15).
 */

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const idParam = z.object({ id: z.string().max(100) });
const errs = { ...authErrors, ...notFoundError, ...commonErrors };
const BASE = '/interview/question-sets';

export function interviewRoutes(db: Database): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();

  app.openapi(createRoute({ method: 'get', path: BASE, tags: ['interview'], summary: 'Every practice set, newest first.', responses: { 200: ok('Sets.', interviewSetListSchema), ...errs } }), async (c) =>
    c.json(checked(interviewSetListSchema, { data: await interview.listSets(db, requireAuth(c).identity) }), 200),
  );

  app.openapi(
    createRoute({ method: 'get', path: `${BASE}/by-generation/{id}`, tags: ['interview'], summary: 'The set a run wrote; null while it is in flight.', request: { params: idParam }, responses: { 200: ok('The set, or null.', interviewSetOrNullSchema), ...errs } }),
    async (c) => c.json(checked(interviewSetOrNullSchema, { set: await interview.setByGeneration(db, requireAuth(c).identity, c.req.valid('param').id) }), 200),
  );

  app.openapi(createRoute({ method: 'get', path: `${BASE}/{id}`, tags: ['interview'], summary: 'One set.', request: { params: idParam }, responses: { 200: ok('The set.', interviewSetSchema), ...errs } }), async (c) =>
    c.json(checked(interviewSetSchema, await interview.getSet(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({
      method: 'put',
      path: `${BASE}/{id}/questions/{questionId}/mark`,
      tags: ['interview'],
      summary: 'Mark one question; answers the whole set, so its counts move with the mark.',
      request: { params: z.object({ id: z.string().max(100), questionId: z.string().min(1).max(80) }), body: json(interviewMarkBodySchema) },
      responses: { 200: ok('The set.', interviewSetSchema), ...errs },
    }),
    async (c) => {
      const { id, questionId } = c.req.valid('param');
      return c.json(checked(interviewSetSchema, await interview.markQuestion(db, requireAuth(c).identity, id, questionId, c.req.valid('json').mark)), 200);
    },
  );

  app.openapi(createRoute({ method: 'post', path: `${BASE}/{id}/reset`, tags: ['interview'], summary: 'Clear every mark, for a clean second pass.', request: { params: idParam }, responses: { 200: ok('The set.', interviewSetSchema), ...errs } }), async (c) =>
    c.json(checked(interviewSetSchema, await interview.resetMarks(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(createRoute({ method: 'delete', path: `${BASE}/{id}`, tags: ['interview'], summary: 'Delete one set; sets regenerated from it are kept.', request: { params: idParam }, responses: { 204: { description: 'Deleted.' }, ...errs } }), async (c) => {
    await interview.removeSet(db, requireAuth(c).identity, c.req.valid('param').id);
    return c.body(null, 204);
  });

  return app;
}
