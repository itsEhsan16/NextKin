import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import * as support from '../../services/support';
import type { ApiEnv } from '../env';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * Support (spec §8.5; ImBackendImplementationPlan P12-13). The FAQ and the legal documents are
 * public reads of the published version; a ticket needs a session and is emailed with its request id.
 */

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });

const faqSchema = z.object({ data: z.array(z.object({ id: z.string(), topic: z.enum(['getting_started', 'resumes', 'jobs', 'billing', 'account']), question: z.string(), answer: z.string() })) });
const legalSchema = z.object({ key: z.enum(['terms', 'privacy']), title: z.string(), updatedAt: z.string(), intro: z.string(), sections: z.array(z.object({ id: z.string(), heading: z.string(), body: z.string() })), url: z.string() });
const ticketInputSchema = z.object({ topic: z.enum(['question', 'bug', 'billing', 'account', 'feedback']), message: z.string().trim().min(1).max(5000) }).strict();
const ticketSchema = z.object({ id: z.string(), topic: z.enum(['question', 'bug', 'billing', 'account', 'feedback']), message: z.string(), email: z.string(), createdAt: z.string() });

export function supportRoutes(deps: support.SupportDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();

  app.openapi(createRoute({ method: 'get', path: '/support/faq', tags: ['support'], summary: 'The published FAQ.', responses: { 200: ok('The FAQ.', faqSchema), ...commonErrors } }), async (c) =>
    c.json(checked(faqSchema, { data: await support.listFaq(deps.db) }), 200),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/support/legal/{key}', tags: ['support'], summary: 'A legal document, its published version.', request: { params: z.object({ key: z.enum(['terms', 'privacy']) }) }, responses: { 200: ok('The document.', legalSchema), ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(legalSchema, await support.getLegal(deps.db, c.req.valid('param').key)), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/support/tickets', tags: ['support'], summary: 'Send a support message; it is emailed to the support inbox with its request id.', request: { body: json(ticketInputSchema) }, responses: { 201: ok('The ticket.', ticketSchema), ...authErrors, ...commonErrors } }),
    async (c) => c.json(checked(ticketSchema, await support.submitTicket(deps, requireAuth(c).identity, c.req.valid('json'), c.get('requestId') ?? null)), 201),
  );

  return app;
}
