import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { ResumeDocumentWrite } from '@nextkin/shared/models/resumeDocument';
import { resumeDocumentSaveSchema, resumeDocumentSchema } from '@nextkin/shared/schemas/resumeDocument';

import type { Database } from '../../db/database';
import { getDocument, saveDocument } from '../../services/resumeDocument';
import type { ApiEnv } from '../env';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError, writeErrors } from './common';

/**
 * The resume editor's document (toreview §124): GET reads it whole with its revision; PUT saves it
 * whole from the revision it was edited from, and a newer one refuses it (412).
 */

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const idParam = z.object({ id: z.string().uuid() });
const errs = { ...authErrors, ...notFoundError, ...commonErrors };

export function resumeDocumentRoutes(deps: { db: Database }): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();

  app.openapi(
    createRoute({ method: 'get', path: '/resumes/{id}/document', tags: ['resumes'], summary: 'The editor’s whole document, with its revision.', request: { params: idParam }, responses: { 200: ok('The document.', resumeDocumentSchema), ...errs } }),
    async (c) => c.json(checked(resumeDocumentSchema, await getDocument(deps.db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({
      method: 'put',
      path: '/resumes/{id}/document',
      tags: ['resumes'],
      summary: 'Save the whole document from the revision it was edited from; a new version, re-checked.',
      request: { params: idParam, body: { required: true, content: { 'application/json': { schema: resumeDocumentSaveSchema } } } },
      responses: { 200: ok('The saved document.', resumeDocumentSchema), ...writeErrors, ...errs },
    }),
    async (c) => {
      const { document, baseRevision } = c.req.valid('json');
      const saved = await saveDocument(deps.db, requireAuth(c).identity, c.req.valid('param').id, document as ResumeDocumentWrite, baseRevision);
      return c.json(checked(resumeDocumentSchema, saved), 200);
    },
  );
  return app;
}
