import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { shareCreateSchema, shareLinkSchema, sharedReportLinkListSchema, sharedReportSchema } from '@nextkin/shared/schemas/sharedReport';

import type { Database } from '../../db/database';
import * as shares from '../../services/sharedReports';
import type { ApiEnv } from '../env';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * Shareable ATS reports (ImBackendImplementationPlan P11-10; V2 §4.1). The owner creates, lists and
 * revokes links; anyone with a link reads its redacted snapshot. The public read never says whether
 * a token was revoked or never existed.
 */

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const idParam = z.object({ id: z.string().max(100) });
const errs = { ...authErrors, ...notFoundError, ...commonErrors };

export function sharedReportRoutes(deps: { db: Database; appOrigin: string }): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const { db } = deps;

  app.openapi(
    createRoute({
      method: 'post',
      path: '/resumes/{id}/share',
      tags: ['shared-reports'],
      summary: 'A new view-only link to the document’s ATS report, redacted. The link is shown once.',
      request: { params: idParam, body: { required: false, content: { 'application/json': { schema: shareCreateSchema } } } },
      responses: { 201: ok('The link.', shareLinkSchema), 409: { description: 'The document has no report yet (CONFLICT).' }, ...errs },
    }),
    async (c) => {
      const identity = requireAuth(c).identity;
      const body = c.req.valid('json') as z.infer<typeof shareCreateSchema> | undefined;
      return c.json(checked(shareLinkSchema, await shares.createShare(db, identity, c.req.valid('param').id, { showEmployer: body?.showEmployer ?? false, origin: deps.appOrigin })), 201);
    },
  );

  app.openapi(createRoute({ method: 'get', path: '/shared-reports', tags: ['shared-reports'], summary: 'The user’s share links, revoked ones included.', responses: { 200: ok('Links.', sharedReportLinkListSchema), ...errs } }), async (c) =>
    c.json(checked(sharedReportLinkListSchema, { data: await shares.listShares(db, requireAuth(c).identity) }), 200),
  );

  app.openapi(createRoute({ method: 'delete', path: '/shared-reports/{id}', tags: ['shared-reports'], summary: 'Revoke a link; it stops working at once.', request: { params: idParam }, responses: { 204: { description: 'Revoked.' }, ...errs } }), async (c) => {
    await shares.revokeShare(db, requireAuth(c).identity, c.req.valid('param').id);
    return c.body(null, 204);
  });

  app.openapi(
    createRoute({ method: 'get', path: '/public/shared-reports/{token}', tags: ['shared-reports'], summary: 'Public: a shared report’s redacted snapshot.', request: { params: z.object({ token: z.string().max(100) }) }, responses: { 200: ok('The report.', sharedReportSchema), ...notFoundError, ...commonErrors } }),
    async (c) => {
      c.header('Cache-Control', 'private, no-store');
      c.header('X-Robots-Tag', 'noindex');
      return c.json(checked(sharedReportSchema, await shares.readShared(db, c.req.valid('param').token)), 200);
    },
  );

  return app;
}
