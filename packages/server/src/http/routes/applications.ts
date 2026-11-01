import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  applicationAnswerSchema,
  applicationAskResultSchema,
  applicationAsksSchema,
  applicationListSchema,
  applicationSchema,
  applicationStatusSchema,
  applicationTargetSchema,
  saveJobSchema,
} from '@nextkin/shared/schemas/job';

import type { Database } from '../../db/database';
import * as applications from '../../services/applications';
import type { ApiEnv } from '../env';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * `/api/v1/applications` (owner, 2026-10-31; changes D-05). What the candidate told us about where
 * they applied: NextKin submits nothing, and no employer event moves a row.
 */

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const idParam = z.object({ id: z.string().uuid() });
const errs = { ...authErrors, ...notFoundError, ...commonErrors };

export function applicationRoutes(db: Database): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();

  app.openapi(
    createRoute({ method: 'get', path: '/applications', tags: ['applications'], summary: 'The jobs the candidate says they applied to, newest first.', responses: { 200: ok('Applications.', applicationListSchema), ...errs } }),
    async (c) => c.json(checked(applicationListSchema, { items: await applications.listApplications(db, requireAuth(c).identity) }), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/applications', tags: ['applications'], summary: 'Record that the candidate applied. Idempotent per job.', request: { body: json(saveJobSchema) }, responses: { 200: ok('The application.', applicationSchema), ...errs } }),
    async (c) => c.json(checked(applicationSchema, await applications.recordApplied(db, requireAuth(c).identity, c.req.valid('json').jobId)), 200),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/applications/asks', tags: ['applications'], summary: 'The "Did you apply?" questions due now, oldest first.', responses: { 200: ok('Asks.', applicationAsksSchema), ...errs } }),
    async (c) => c.json(checked(applicationAsksSchema, { items: await applications.listAsks(db, requireAuth(c).identity) }), 200),
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/applications/asks',
      tags: ['applications'],
      summary: 'Start "Did you apply?" for a job, or the job a resume was made for. Null when there is nothing to ask.',
      request: { body: json(applicationTargetSchema) },
      responses: { 200: ok('The ask, if it should be shown now.', applicationAskResultSchema), ...errs },
    }),
    async (c) => c.json(checked(applicationAskResultSchema, { ask: await applications.askAbout(db, requireAuth(c).identity, c.req.valid('json')) }), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/applications/asks/{id}/answer', tags: ['applications'], summary: 'Answer "Did you apply?": yes, not yet (once more, a day later) or no.', request: { params: idParam, body: json(applicationAnswerSchema) }, responses: { 204: { description: 'Answered.' }, ...errs } }),
    async (c) => {
      await applications.answerAsk(db, requireAuth(c).identity, c.req.valid('param').id, c.req.valid('json').answer);
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({ method: 'patch', path: '/applications/{id}', tags: ['applications'], summary: 'Record where an application has got to, as the candidate says.', request: { params: idParam, body: json(applicationStatusSchema) }, responses: { 200: ok('The application.', applicationSchema), ...errs } }),
    async (c) => {
      const { status, interviewAt } = c.req.valid('json');
      return c.json(checked(applicationSchema, await applications.setStatus(db, requireAuth(c).identity, c.req.valid('param').id, status, interviewAt)), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/applications/{id}/check-in', tags: ['applications'], summary: 'Say there is no news yet, which answers a follow-up without moving the application.', request: { params: idParam }, responses: { 200: ok('The application.', applicationSchema), ...errs } }),
    async (c) => c.json(checked(applicationSchema, await applications.checkIn(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  return app;
}
