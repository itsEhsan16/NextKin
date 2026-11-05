import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import * as business from '../../services/admin/business';
import { analyticsReport } from '../../services/admin/businessAnalytics';
import { overview } from '../../services/admin/overview';
import { requireStaff } from '../../services/admin/permissions';
import type { ApiEnv } from '../env';
import type { AdminRouteDeps } from './admin';
import { admin, auditMeta, errs, idParam, json, ok, staffOnly } from './adminKit';

/**
 * The admin portal's Business routes and the Overview (`toreview.md` §171.13). Mounted beside
 * `admin.ts`; every handler checks its permission with `requireStaff`, and every change is audited
 * in the same transaction as the change. Figures are aggregates over our own tables; what nothing
 * records comes back `null` (`services/admin/overview.ts`).
 */

const range = z.object({ range: z.enum(['7d', '30d', '90d']).default('30d') });
const price = z.number().int().min(1).max(10_000_000);
const prices = z.object({ USD: price, EUR: price, AUD: price }).strict();

export function adminBusinessRoutes(deps: AdminRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  app.use('/admin/*', staffOnly);
  const { db } = deps;
  const an = admin('analytics.read');
  const plans = admin('plans.manage');
  const manage = admin('users.manage');
  const prov = admin('providers.manage');

  app.openapi(createRoute({ method: 'get', path: '/admin/overview', tags: ['admin'], summary: an.describe('The Overview for a window: headline rates, runs, pipeline, spend, Pro, ATS, providers'), request: { query: range }, responses: { 200: ok('The Overview.'), ...errs } }), async (c) => {
    requireStaff(c, 'analytics.read');
    return c.json(await overview(db, c.req.valid('query').range), 200);
  });

  app.openapi(createRoute({ method: 'get', path: '/admin/analytics/report', tags: ['admin'], summary: an.describe('The Analytics page for a window: funnel, runs, ATS, Free quota use, model usage'), request: { query: range }, responses: { 200: ok('The report.'), ...errs } }), async (c) => {
    requireStaff(c, 'analytics.read');
    return c.json(await analyticsReport(db, c.req.valid('query').range), 200);
  });

  app.openapi(createRoute({ method: 'get', path: '/admin/price-book', tags: ['admin'], summary: plans.describe('The price book: every version of the Pro prices, newest first'), responses: { 200: ok('Versions.'), ...errs } }), async (c) => {
    requireStaff(c, 'plans.manage');
    return c.json({ data: await business.listPriceBook(db) }, 200);
  });

  app.openapi(
    createRoute({ method: 'post', path: '/admin/price-book', tags: ['admin'], summary: plans.describe('A new price-book version: Pro monthly and annual together (minor units)'), request: { body: json(z.object({ monthly: prices, annual: prices }).strict()) }, responses: { 200: ok('The new version.'), ...errs } }),
    async (c) => c.json(await business.createPriceVersion(db, requireStaff(c, 'plans.manage'), c.req.valid('json'), auditMeta(c)), 200),
  );

  app.openapi(createRoute({ method: 'get', path: '/admin/plans/stats', tags: ['admin'], summary: plans.describe('Accounts on each plan now, and when its quotas last changed'), responses: { 200: ok('Per plan.'), ...errs } }), async (c) => {
    requireStaff(c, 'plans.manage');
    return c.json(await business.planStats(db), 200);
  });

  app.openapi(createRoute({ method: 'get', path: '/admin/comps', tags: ['admin'], summary: plans.describe('Comped Pro still running, ten a page'), request: { query: z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1) }) }, responses: { 200: ok('Comps.'), ...errs } }), async (c) => {
    requireStaff(c, 'plans.manage');
    return c.json(await business.listComps(db, c.req.valid('query').page), 200);
  });

  app.openapi(
    createRoute({ method: 'post', path: '/admin/comps/{id}/end', tags: ['admin'], summary: manage.describe('End comped Pro now'), request: { params: idParam }, responses: { 200: ok('Ended.'), ...errs } }),
    async (c) => c.json(await business.endComp(db, requireStaff(c, 'users.manage'), c.req.valid('param').id, auditMeta(c)), 200),
  );

  app.openapi(createRoute({ method: 'get', path: '/admin/providers/stats', tags: ['admin'], summary: prov.describe('Each job provider’s calls and errors today, its week, its key and its pause'), responses: { 200: ok('Per provider.'), ...errs } }), async (c) => {
    requireStaff(c, 'providers.manage');
    return c.json(await business.providerStats(db), 200);
  });

  return app;
}
