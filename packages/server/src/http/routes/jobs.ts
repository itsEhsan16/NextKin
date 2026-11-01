import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { hiddenPicksSchema, jobCountSchema, jobFiltersQuerySchema, jobListSchema, jobPageSchema, jobSchema, jobSearchQuerySchema, savedNotesSchema, saveJobSchema } from '@nextkin/shared/schemas/job';

import type { IdempotencyStore } from '../../cache/stores';
import type { Flags } from '../../flags/flags';
import * as jobs from '../../services/jobs';
import type { MiddlewareHandler } from 'hono';

import type { ApiEnv } from '../env';
import { feature, idempotent, requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError, writeErrors } from './common';

/**
 * `/api/v1/jobs` (spec §11; ImBackendImplementationPlan P11-04, P11-05). Search and counts read the
 * merged provider result; picks are computed per user; every listing carries its match basis and
 * provider attribution. Saving is idempotent and capped on Free. Applications have their own
 * routes, and a link is read through `/jd`.
 */

export interface JobRouteDeps {
  jobs: jobs.JobsDeps;
  idempotency: IdempotencyStore;
  flags: Flags;
}

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const idParam = z.object({ id: z.string().max(100) });
const errs = { ...authErrors, ...notFoundError, ...commonErrors };
const DISABLED = 'Job search is paused for a moment. Your saved jobs are safe.';

export function jobRoutes(deps: JobRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const d = deps.jobs;
  // Signed in first, so an anonymous call is 401 before any query is validated.
  const signedIn: MiddlewareHandler<ApiEnv> = async (c, next) => {
    requireAuth(c);
    await next();
  };
  app.use('/jobs/*', signedIn, feature(deps.flags, 'job_search', DISABLED));

  app.openapi(
    createRoute({ method: 'get', path: '/jobs/search', tags: ['jobs'], summary: 'Search listings: filters as repeated query keys, a sort, a cursor.', request: { query: jobSearchQuerySchema }, responses: { 200: ok('A page of listings.', jobPageSchema), 503: { description: 'Job search is switched off (UNAVAILABLE).' }, ...errs } }),
    async (c) => {
      const { sort, cursor, ...filters } = c.req.valid('query');
      return c.json(checked(jobPageSchema, await jobs.searchJobs(d, requireAuth(c).identity, filters, sort, cursor)), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'get', path: '/jobs/count', tags: ['jobs'], summary: 'How many listings match a filter set (the filter sheet’s live count).', request: { query: jobFiltersQuerySchema }, responses: { 200: ok('The count.', jobCountSchema), ...errs } }),
    async (c) => {
      requireAuth(c);
      return c.json(checked(jobCountSchema, { count: await jobs.countJobs(d, c.req.valid('query')) }), 200);
    },
  );

  app.openapi(createRoute({ method: 'get', path: '/jobs/picks/hidden', tags: ['jobs'], summary: 'What the picks left out for clashing with the candidate’s preferences, and why.', responses: { 200: ok('What was left out.', hiddenPicksSchema), ...errs } }), async (c) =>
    c.json(checked(hiddenPicksSchema, await jobs.hiddenPicks(d, requireAuth(c).identity)), 200),
  );

  app.openapi(createRoute({ method: 'get', path: '/jobs/picks', tags: ['jobs'], summary: 'The open listings that best match the profile.', responses: { 200: ok('Picks.', jobListSchema), ...errs } }), async (c) =>
    c.json(checked(jobListSchema, { data: await jobs.listPicks(d, requireAuth(c).identity) }), 200),
  );

  app.openapi(createRoute({ method: 'get', path: '/jobs/todays-picks', tags: ['jobs'], summary: 'The best matches posted in the last two days.', responses: { 200: ok('Picks.', jobListSchema), ...errs } }), async (c) =>
    c.json(checked(jobListSchema, { data: await jobs.listTodaysPicks(d, requireAuth(c).identity) }), 200),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/jobs/saved', tags: ['jobs'], summary: 'The user’s saved jobs; a listing its source closed is flagged, not removed.', request: { query: z.object({ sort: z.enum(['recent', 'closing', 'salary']).default('recent') }) }, responses: { 200: ok('Saved jobs.', jobListSchema), ...errs } }),
    async (c) => c.json(checked(jobListSchema, { data: await jobs.listSaved(d, requireAuth(c).identity, c.req.valid('query').sort) }), 200),
  );

  app.on('POST', '/jobs/saved', idempotent(deps.idempotency, { required: false }));
  app.openapi(
    createRoute({ method: 'post', path: '/jobs/saved', tags: ['jobs'], summary: 'Save a listing. Idempotent; Free saves up to 10 open listings.', request: { body: json(saveJobSchema) }, responses: { 200: ok('The saved listing.', jobSchema), 402: { description: 'The Free cap (PLAN_LOCKED).' }, ...writeErrors, ...errs } }),
    async (c) => c.json(checked(jobSchema, await jobs.setSaved(d, requireAuth(c).identity, c.req.valid('json').jobId, true)), 200),
  );

  app.openapi(
    createRoute({ method: 'delete', path: '/jobs/saved/{id}', tags: ['jobs'], summary: 'Unsave a listing. Idempotent.', request: { params: idParam }, responses: { 200: ok('The listing, unsaved.', jobSchema), ...errs } }),
    async (c) => c.json(checked(jobSchema, await jobs.setSaved(d, requireAuth(c).identity, c.req.valid('param').id, false)), 200),
  );

  app.openapi(
    createRoute({ method: 'patch', path: '/jobs/saved/{id}', tags: ['jobs'], summary: 'Notes on a saved listing.', request: { params: idParam, body: json(savedNotesSchema) }, responses: { 204: { description: 'Saved.' }, ...errs } }),
    async (c) => {
      await jobs.setSavedNotes(d, requireAuth(c).identity, c.req.valid('param').id, c.req.valid('json').notes);
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({ method: 'get', path: '/jobs/by-company', tags: ['jobs'], summary: 'Every open role at one employer, newest first.', request: { query: z.object({ company: z.string().min(1).max(200) }) }, responses: { 200: ok('Listings.', jobListSchema), ...errs } }),
    async (c) => c.json(checked(jobListSchema, { data: await jobs.listByCompany(d, requireAuth(c).identity, c.req.valid('query').company) }), 200),
  );

  app.openapi(createRoute({ method: 'get', path: '/jobs/{id}', tags: ['jobs'], summary: 'One listing, from the cache or the user’s saved copy.', request: { params: idParam }, responses: { 200: ok('The listing.', jobSchema), ...errs } }), async (c) =>
    c.json(checked(jobSchema, await jobs.getJob(d, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/jobs/{id}/similar', tags: ['jobs'], summary: 'Same-tag roles at other companies.', request: { params: idParam, query: z.object({ limit: z.coerce.number().int().min(1).max(10).default(3) }) }, responses: { 200: ok('Listings.', jobListSchema), ...errs } }),
    async (c) => c.json(checked(jobListSchema, { data: await jobs.listSimilar(d, requireAuth(c).identity, c.req.valid('param').id, c.req.valid('query').limit) }), 200),
  );

  return app;
}
