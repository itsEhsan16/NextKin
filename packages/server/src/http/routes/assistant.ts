import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { assistantConversationSchema, assistantMessageSchema, assistantSendResultSchema, assistantSendSchema, assistantThreadListSchema } from '@nextkin/shared/schemas/assistant';

import type { Flags } from '../../flags/flags';
import * as assistant from '../../services/assistant';
import type { MiddlewareHandler } from 'hono';
import type { ApiEnv } from '../env';
import { feature, requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * `/api/v1/assistant` (spec §11; ImBackendImplementationPlan P11-09). Sessions are the chats: one
 * current, the rest its history. Sending answers with both turns at once; an in-scope reply arrives
 * empty and streaming, and `GET /assistant/messages/{id}` reads it as it grows. Read and advise
 * only: no route here writes anything but the chat.
 */

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const idParam = z.object({ id: z.string().max(100) });
const errs = { ...authErrors, ...notFoundError, ...commonErrors };

export function assistantRoutes(deps: assistant.AssistantDeps & { flags: Flags }): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const { db } = deps;
  // Signed in first, so an anonymous call is 401 before any body is validated.
  const signedIn: MiddlewareHandler<ApiEnv> = async (c, next) => {
    requireAuth(c);
    await next();
  };
  app.use('/assistant/*', signedIn, feature(deps.flags, 'assistant', 'The assistant is paused for a moment. Your chats are safe.'));

  app.openapi(createRoute({ method: 'get', path: '/assistant/sessions', tags: ['assistant'], summary: 'The chats: the current one first, then the history, newest first.', responses: { 200: ok('Chats.', assistantThreadListSchema), ...errs } }), async (c) =>
    c.json(checked(assistantThreadListSchema, { data: await assistant.listThreads(db, requireAuth(c).identity) }), 200),
  );

  app.openapi(createRoute({ method: 'get', path: '/assistant/sessions/current', tags: ['assistant'], summary: 'The chat the composer writes to (made on first use).', responses: { 200: ok('The chat.', assistantConversationSchema), ...errs } }), async (c) =>
    c.json(checked(assistantConversationSchema, await assistant.getConversation(db, requireAuth(c).identity)), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/assistant/sessions', tags: ['assistant'], summary: 'Start a new chat; the current one, if it has anything in it, joins the history.', responses: { 200: ok('The new current chat.', assistantConversationSchema), ...errs } }),
    async (c) => c.json(checked(assistantConversationSchema, await assistant.startNew(db, requireAuth(c).identity)), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/assistant/sessions/current/clear', tags: ['assistant'], summary: 'Empty the current chat.', responses: { 200: ok('The emptied chat.', assistantConversationSchema), ...errs } }),
    async (c) => c.json(checked(assistantConversationSchema, await assistant.clearConversation(db, requireAuth(c).identity)), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/assistant/sessions/{id}/open', tags: ['assistant'], summary: 'Make an earlier chat the current one.', request: { params: idParam }, responses: { 200: ok('The chat.', assistantConversationSchema), ...errs } }),
    async (c) => c.json(checked(assistantConversationSchema, await assistant.openThread(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/assistant/messages',
      tags: ['assistant'],
      summary: 'Send a message to the current chat. Counts against the day’s cap; an off-topic one is declined at once.',
      request: { body: json(assistantSendSchema) },
      responses: { 200: ok('Both turns; an in-scope reply is streaming.', assistantSendResultSchema), ...errs, 429: { description: 'The day’s messages are used, or too many requests (RATE_LIMITED; the cap carries resetsAt).' }, 503: { description: 'The classifier is unavailable; the message is not counted.' } },
    }),
    async (c) => c.json(checked(assistantSendResultSchema, await assistant.sendMessage(deps, requireAuth(c).identity, c.req.valid('json'))), 200),
  );

  app.openapi(createRoute({ method: 'get', path: '/assistant/messages/{id}', tags: ['assistant'], summary: 'One message, as far as it has been written.', request: { params: idParam }, responses: { 200: ok('The message.', assistantMessageSchema), ...errs } }), async (c) =>
    c.json(checked(assistantMessageSchema, await assistant.getMessage(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  return app;
}
