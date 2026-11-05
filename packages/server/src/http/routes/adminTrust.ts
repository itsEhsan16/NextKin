import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { requireStaff } from '../../services/admin/permissions';
import * as failures from '../../services/admin/trustFailures';
import * as reports from '../../services/admin/trustReports';
import type { ApiEnv } from '../env';
import type { AdminRouteDeps } from './admin';
import { admin, auditMeta, errs, idParam, json, ok, staffOnly } from './adminKit';
import { commonErrors, notFoundError } from './common';

/**
 * The admin portal's Trust & safety routes (`toreview.md` §171.13): the generation-failure queue and
 * abuse reports. The audit log stays in `admin.ts`. Reads need users.read (support, admin); retrying,
 * closing and settling need users.manage. The queue and the reports come back whole (capped, and
 * flagged when the cap is reached); the portal filters, counts and pages them as the mock does.
 *
 * One public route sits here too: reporting a shared link, so the queue can fill.
 */
export function adminTrustRoutes(deps: AdminRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  app.use('/admin/*', staffOnly);
  const { db } = deps;
  const userDeps = { db, log: deps.log, provider: deps.provider, ...(deps.idp ? { idp: deps.idp } : {}), ...(deps.sessions ? { sessions: deps.sessions } : {}) };
  const read = admin('users.read');
  const manage = admin('users.manage');

  // --- Generation failures ---------------------------------------------------------------------
  app.openapi(createRoute({ method: 'get', path: '/admin/failures', tags: ['admin'], summary: read.describe('The generation-failure queue (90 days, newest first, capped)'), responses: { 200: ok('Runs.'), ...errs } }), async (c) => {
    const { rows, capped } = await failures.listFailures(db, requireStaff(c, 'users.read'));
    return c.json({ data: rows, capped, limit: failures.QUEUE_LIMIT }, 200);
  });
  app.openapi(createRoute({ method: 'get', path: '/admin/failures/stats', tags: ['admin'], summary: read.describe('Failure figures for the last thirty days'), responses: { 200: ok('Figures.'), ...errs } }), async (c) =>
    c.json(await failures.failureStats(db, requireStaff(c, 'users.read')), 200),
  );
  app.openapi(createRoute({ method: 'get', path: '/admin/failures/{id}', tags: ['admin'], summary: read.describe('One failed run: stages, error, prompt version, model, tokens. Never its content'), request: { params: idParam }, responses: { 200: ok('The run.'), ...errs } }), async (c) =>
    c.json(await failures.failureDetail(db, requireStaff(c, 'users.read'), c.req.valid('param').id), 200),
  );
  app.openapi(
    createRoute({ method: 'post', path: '/admin/failures/retry', tags: ['admin'], summary: manage.describe('Retry open runs as their owner would, from the first incomplete stage; audited'), request: { body: json(z.object({ ids: z.array(z.string().max(100)).min(1).max(50) }).strict()) }, responses: { 200: ok('What was retried, and what was skipped and why.'), ...errs } }),
    async (c) => c.json(await failures.retryFailures(db, requireStaff(c, 'users.manage'), c.req.valid('json').ids, auditMeta(c)), 200),
  );
  app.openapi(createRoute({ method: 'post', path: '/admin/failures/{id}/resolve', tags: ['admin'], summary: manage.describe('Close a run without retrying it; audited'), request: { params: idParam }, responses: { 200: ok('Closed.'), ...errs } }), async (c) =>
    c.json(await failures.resolveFailure(db, requireStaff(c, 'users.manage'), c.req.valid('param').id, auditMeta(c)), 200),
  );

  // --- Abuse reports ---------------------------------------------------------------------------
  app.openapi(createRoute({ method: 'get', path: '/admin/reports', tags: ['admin'], summary: read.describe('Abuse reports, newest first, capped. Reporters stay anonymous'), responses: { 200: ok('Reports.'), ...errs } }), async (c) => {
    const { rows, capped } = await reports.listReports(db, requireStaff(c, 'users.read'));
    return c.json({ data: rows, capped, limit: reports.REPORT_LIMIT }, 200);
  });
  app.openapi(createRoute({ method: 'get', path: '/admin/reports/stats', tags: ['admin'], summary: read.describe('Open reports and the last thirty days’ settlements'), responses: { 200: ok('Figures.'), ...errs } }), async (c) =>
    c.json(await reports.reportStats(db, requireStaff(c, 'users.read')), 200),
  );
  app.openapi(createRoute({ method: 'get', path: '/admin/reports/{id}', tags: ['admin'], summary: read.describe('One abuse report with its link, owner and prior reports'), request: { params: idParam }, responses: { 200: ok('The report.'), ...errs } }), async (c) =>
    c.json(await reports.reportDetail(db, requireStaff(c, 'users.read'), c.req.valid('param').id), 200),
  );
  app.openapi(
    createRoute({
      method: 'post',
      path: '/admin/reports/{id}/action',
      tags: ['admin'],
      summary: manage.describe('Settle a report: dismiss it, take the link down, or suspend the owner (which takes the link down too); audited'),
      request: { params: idParam, body: json(z.object({ action: z.enum(reports.REPORT_ACTIONS), reason: z.string().trim().min(1).max(100), note: z.string().max(1000).default('') }).strict()) },
      responses: { 200: ok('The settled report.'), 409: { description: 'Already settled.' }, ...errs },
    }),
    async (c) => c.json(await reports.actOnReport(userDeps, requireStaff(c, 'users.manage'), c.req.valid('param').id, c.req.valid('json'), auditMeta(c)), 200),
  );

  // --- Public: report a shared link ------------------------------------------------------------
  app.openapi(
    createRoute({
      method: 'post',
      path: '/public/shared-reports/{token}/abuse-reports',
      tags: ['shared-reports'],
      summary: 'Public: report a shared link for staff review. Nothing about the reporter is kept.',
      request: { params: z.object({ token: z.string().max(100) }), body: json(z.object({ category: z.enum(reports.REPORT_CATEGORIES), reason: z.string().max(1000).default('') }).strict()) },
      responses: { 202: { description: 'Received.' }, ...notFoundError, ...commonErrors },
    }),
    async (c) => {
      await reports.fileReport(db, c.req.valid('param').token, c.req.valid('json'));
      return c.body(null, 202);
    },
  );

  return app;
}
