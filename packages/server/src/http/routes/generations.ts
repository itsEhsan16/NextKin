import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { generationInputSchema, generationResultSchema, generationSchema } from '@nextkin/shared/schemas/generation';
import { streamSSE } from 'hono/streaming';
import type { IdempotencyStore } from '../../cache/stores';
import type { Database } from '../../db/database';
import { nullPublisher, type EventPublisher, type PublishedEvent } from '../../pipeline/events';
import type { GenerationHub } from '../../pipeline/hub';
import { generationResult } from '../../services/documents';
import * as generations from '../../services/generations';
import type { ApiEnv } from '../env';
import { idempotent, requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError, writeErrors } from './common';

/**
 * `/api/v1/generations` (spec §11; ImBackendImplementationPlan P6-13, P6-15). POST needs an
 * Idempotency-Key: the key is also the run's unique key, so a retried POST returns the run it
 * started. Progress streams over SSE; GET /generations/:id is the polling fallback (§9.3).
 */

export interface GenerationRouteDeps {
  db: Database;
  idempotency: IdempotencyStore;
  publisher?: EventPublisher;
  hub?: GenerationHub;
  /** SSE: the heartbeat interval and how long a stream stays open (tests shorten both). */
  heartbeatMs?: number;
  streamMs?: number;
}

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const idParam = z.object({ id: z.string().max(100) });
const TERMINAL = new Set(['completed', 'failed']);

export function generationRoutes(deps: GenerationRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const { db } = deps;
  const publisher = deps.publisher ?? nullPublisher;
  const heartbeatMs = deps.heartbeatMs ?? 15_000;
  const streamMs = deps.streamMs ?? 5 * 60_000;

  app.use('/generations', async (c, next) => {
    if (c.req.method === 'POST') requireAuth(c);
    await next();
  });
  app.on('POST', '/generations', idempotent(deps.idempotency, { required: true }));
  app.openapi(
    createRoute({
      method: 'post',
      path: '/generations',
      tags: ['generations'],
      summary: 'Start a run. Requires Idempotency-Key; a repeat returns the run it already started.',
      request: { headers: z.object({ 'idempotency-key': z.string() }), body: { required: true, content: { 'application/json': { schema: generationInputSchema } } } },
      responses: { 201: ok('Started.', generationSchema), 200: ok('Already started with this key.', generationSchema), ...authErrors, ...writeErrors, ...commonErrors },
    }),
    async (c) => {
      const { identity } = requireAuth(c);
      const result = await generations.startGeneration(db, identity, c.req.valid('json'), {
        idempotencyKey: c.req.valid('header')['idempotency-key'],
        correlationId: c.get('requestId'),
      });
      return result.created ? c.json(checked(generationSchema, result.generation), 201) : c.json(checked(generationSchema, result.generation), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'get', path: '/generations', tags: ['generations'], summary: 'Recent runs, newest first.', responses: { 200: ok('Runs.', z.object({ items: z.array(generationSchema) })), ...authErrors, ...commonErrors } }),
    async (c) => c.json(checked(z.object({ items: z.array(generationSchema) }), { items: await generations.listGenerations(db, requireAuth(c).identity) }), 200),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/generations/active', tags: ['generations'], summary: 'The run in progress, if any.', responses: { 200: ok('The active run or null.', z.object({ generation: generationSchema.nullable() })), ...authErrors, ...commonErrors } }),
    async (c) => c.json(checked(z.object({ generation: generationSchema.nullable() }), { generation: await generations.activeGeneration(db, requireAuth(c).identity) }), 200),
  );

  app.openapi(
    createRoute({ method: 'get', path: '/generations/{id}', tags: ['generations'], summary: 'One run (the polling fallback for the stream).', request: { params: idParam }, responses: { 200: ok('The run.', generationSchema), ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(generationSchema, await generations.getGeneration(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/generations/{id}/result',
      tags: ['generations'],
      summary: 'A finished run’s document: the card, the body and the score panel.',
      request: { params: idParam },
      responses: { 200: ok('The document.', generationResultSchema), 409: { description: 'The run has not finished.' }, ...authErrors, ...notFoundError, ...commonErrors },
    }),
    async (c) => c.json(checked(generationResultSchema, await generationResult(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/generations/{id}/retry', tags: ['generations'], summary: 'Resume a failed run from its first incomplete stage.', request: { params: idParam }, responses: { 200: ok('Queued again.', generationSchema), 409: { description: 'Not a failed run.' }, ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(generationSchema, await generations.retryGeneration(db, requireAuth(c).identity, publisher, c.req.valid('param').id, c.get('requestId'))), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/generations/{id}/cancel', tags: ['generations'], summary: 'Stop a run: at once if queued, at the next stage if running. Nothing is charged.', request: { params: idParam }, responses: { 200: ok('The run.', generationSchema), ...authErrors, ...notFoundError, ...commonErrors } }),
    async (c) => c.json(checked(generationSchema, await generations.cancelGeneration(db, requireAuth(c).identity, publisher, c.req.valid('param').id)), 200),
  );

  // Server-Sent Events. Registered plainly (not openapi): the body is a stream, not JSON.
  app.get('/generations/:id/events', async (c) => {
    const { identity } = requireAuth(c);
    const id = c.req.param('id');
    let current = await generations.getGeneration(db, identity, id); // 404 for someone else's run
    const asked = Number(c.req.header('last-event-id') ?? c.req.query('lastEventId') ?? 0) || 0;
    // A fresh connection to a run that is live again (retried) starts after its last ending.
    const live = current.status !== 'ready' && current.status !== 'failed';
    const resumeFrom = asked || (live ? await generations.lastTerminalEventId(db, identity, id) : 0);
    c.header('Cache-Control', 'no-store');
    c.header('X-Accel-Buffering', 'no');

    return streamSSE(c, async (stream) => {
      let last = resumeFrom;
      let open = true;
      const buffered: PublishedEvent[] = [];
      let live: ((event: PublishedEvent) => void) | null = (event) => buffered.push(event);
      const unwatch = deps.hub?.watch(id, (event) => live?.(event));
      stream.onAbort(() => {
        open = false;
      });

      const send = async (event: PublishedEvent) => {
        if (Number(event.id) <= last) return;
        last = Number(event.id);
        current = event.data;
        await stream.writeSSE({ id: event.id, event: event.event, data: JSON.stringify(event.data) });
        if (TERMINAL.has(event.event)) open = false;
      };

      try {
        // Replay what was missed, then whatever arrived meanwhile, then live.
        for (const event of await generations.eventsAfter(db, identity, id, last)) await send(event);
        for (const event of buffered.splice(0)) await send(event);
        const queue: PublishedEvent[] = [];
        let wake: (() => void) | null = null;
        live = (event) => {
          queue.push(event);
          wake?.();
        };
        const deadline = Date.now() + streamMs;
        let lastBeat = Date.now();
        let lastPoll = Date.now();
        while (open && Date.now() < deadline && current.status !== 'ready' && current.status !== 'failed') {
          await new Promise<void>((resolve) => {
            wake = resolve;
            setTimeout(resolve, Math.min(1000, heartbeatMs));
          });
          wake = null;
          for (const event of queue.splice(0)) await send(event);
          // Without the hub (or with it down), poll the table every second (§9.3 fallback).
          if ((!deps.hub || !deps.hub.healthy) && Date.now() - lastPoll >= 1000) {
            lastPoll = Date.now();
            for (const event of await generations.eventsAfter(db, identity, id, last)) await send(event);
          }
          if (Date.now() - lastBeat >= heartbeatMs) {
            lastBeat = Date.now();
            await stream.write(': heartbeat\n\n');
          }
        }
      } finally {
        unwatch?.();
      }
    });
  });

  return app;
}
