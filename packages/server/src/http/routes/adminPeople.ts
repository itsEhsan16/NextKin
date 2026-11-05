import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import * as people from '../../services/admin/people';
import { assertUserId, userProfile } from '../../services/admin/peopleDetail';
import * as deletions from '../../services/admin/peopleDeletions';
import { requireStaff } from '../../services/admin/permissions';
import type { ApiEnv } from '../env';
import type { AdminRouteDeps } from './admin';
import { admin, auditMeta, errs, idParam, json, ok, staffOnly } from './adminKit';

/**
 * The admin portal's People routes (`toreview.md` §171.13): the Users page's totals, browsing every
 * account, one user's detail page and the deletion queue. Mounted beside `admin.ts`, under
 * `/admin/people/` so no path collides with `/admin/users/{id}`. Every handler checks its
 * permission with `requireStaff`; the one write is audited in the same transaction as the change.
 */
export function adminPeopleRoutes(deps: AdminRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  app.use('/admin/*', staffOnly);
  const { db } = deps;
  const read = admin('users.read');
  const manage = admin('users.manage');

  app.openapi(createRoute({ method: 'get', path: '/admin/people/stats', tags: ['admin'], summary: read.describe('The Users page totals: accounts, new, active, Pro, comped, suspended, pending deletion'), responses: { 200: ok('Totals.'), ...errs } }), async (c) =>
    c.json(await people.userStats(db, requireStaff(c, 'users.read')), 200),
  );

  const browse = z.object({
    filter: z.enum(['all', 'free', 'pro', 'suspended', 'deletion_pending']).default('all'),
    q: z.string().max(120).default(''),
    sort: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
  });
  app.openapi(createRoute({ method: 'get', path: '/admin/people/users', tags: ['admin'], summary: read.describe(`Every account, filtered, searched and paged (${people.PAGE_SIZE} a page) by sign-up date`), request: { query: browse }, responses: { 200: ok('A page of accounts.'), ...errs } }), async (c) =>
    c.json(await people.browseUsers(db, requireStaff(c, 'users.read'), c.req.valid('query')), 200),
  );

  app.openapi(createRoute({ method: 'get', path: '/admin/people/users/{id}', tags: ['admin'], summary: read.describe('One user for the detail page: plan, billing, resumes (metadata), security events, staff actions'), request: { params: idParam }, responses: { 200: ok('The user.'), ...errs } }), async (c) => {
    const staff = requireStaff(c, 'users.read');
    const { id } = c.req.valid('param');
    assertUserId(id);
    return c.json(await userProfile(db, staff, id), 200);
  });

  app.openapi(createRoute({ method: 'get', path: '/admin/people/deletions', tags: ['admin'], summary: read.describe('Deletion requests, newest first (§8.5: finished within 30 days)'), request: { query: z.object({ filter: z.enum(['all', 'open', 'completed']).default('all') }) }, responses: { 200: ok('Requests.'), ...errs } }), async (c) =>
    c.json({ data: await deletions.listDeletions(db, requireStaff(c, 'users.read'), c.req.valid('query').filter) }, 200),
  );

  app.openapi(createRoute({ method: 'post', path: '/admin/people/deletions/{id}/process', tags: ['admin'], summary: manage.describe('Start a waiting request’s purge now, with a reason'), request: { params: idParam, body: json(z.object({ reason: z.string().min(3).max(500) }).strict()) }, responses: { 200: ok('Purging.'), ...errs } }), async (c) =>
    c.json(await deletions.processDeletion(db, requireStaff(c, 'users.manage'), c.req.valid('param').id, c.req.valid('json').reason, auditMeta(c)), 200),
  );

  return app;
}
