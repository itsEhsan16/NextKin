import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { productEventsSchema } from '@nextkin/shared/schemas/events';

import type { Database } from '../../db/database';
import { recordEvents } from '../../services/events';
import type { ApiEnv } from '../env';
import { requireAuth } from '../middleware/guards';
import { authErrors, commonErrors } from './common';

/** `/api/v1/events` (owner, 2026-10-31): usage events, on our own server, for people not opted out. */
export function eventRoutes(db: Database): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();

  app.openapi(
    createRoute({
      method: 'post',
      path: '/events',
      tags: ['events'],
      summary: 'Record a batch of usage events. Dropped quietly for someone who opted out.',
      request: { body: { required: true, content: { 'application/json': { schema: productEventsSchema as z.ZodType<z.infer<typeof productEventsSchema>> } } } },
      responses: { 204: { description: 'Accepted.' }, ...authErrors, ...commonErrors },
    }),
    async (c) => {
      await recordEvents(db, requireAuth(c).identity, c.req.valid('json').events, { platform: c.req.header('x-client'), version: c.req.header('x-client-version') });
      return c.body(null, 204);
    },
  );

  return app;
}
