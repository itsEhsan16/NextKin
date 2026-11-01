import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { notificationListSchema, notificationSchema, pushDeviceSchema, pushDeviceTokenSchema } from '@nextkin/shared/schemas/account';

import type { Database } from '../../db/database';
import * as notifications from '../../services/notifications';
import * as push from '../../services/push';
import type { ApiEnv } from '../env';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError } from './common';

/** `/api/v1/notifications` (owner, 2026-10-31; changes D-05): the in-app feed. */

const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const idParam = z.object({ id: z.string().uuid() });
const errs = { ...authErrors, ...notFoundError, ...commonErrors };

export function notificationRoutes(db: Database): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();

  app.openapi(
    createRoute({ method: 'get', path: '/notifications', tags: ['notifications'], summary: 'The feed, newest first, up to 100 rows.', responses: { 200: ok('The feed.', notificationListSchema), ...errs } }),
    async (c) => c.json(checked(notificationListSchema, { items: await notifications.listNotifications(db, requireAuth(c).identity) }), 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/notifications/read-all', tags: ['notifications'], summary: 'Mark the whole feed read.', responses: { 204: { description: 'Done.' }, ...errs } }),
    async (c) => {
      await notifications.markAllRead(db, requireAuth(c).identity);
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/notifications/devices', tags: ['notifications'], summary: 'This phone said yes to push. A token on another account moves here.', request: { body: json(pushDeviceSchema) }, responses: { 204: { description: 'Registered.' }, ...errs } }),
    async (c) => {
      await push.registerDevice(db, requireAuth(c).identity, c.req.valid('json'));
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/notifications/devices/remove', tags: ['notifications'], summary: 'This phone stops hearing, on signing out.', request: { body: json(pushDeviceTokenSchema) }, responses: { 204: { description: 'Removed.' }, ...errs } }),
    async (c) => {
      await push.removeDevice(db, requireAuth(c).identity, c.req.valid('json').token);
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/notifications/{id}/read', tags: ['notifications'], summary: 'Mark one notification read.', request: { params: idParam }, responses: { 200: ok('The notification.', notificationSchema), ...errs } }),
    async (c) => c.json(checked(notificationSchema, await notifications.markRead(db, requireAuth(c).identity, c.req.valid('param').id)), 200),
  );

  app.openapi(
    createRoute({ method: 'delete', path: '/notifications/{id}', tags: ['notifications'], summary: 'Remove one notification.', request: { params: idParam }, responses: { 204: { description: 'Removed.' }, ...errs } }),
    async (c) => {
      await notifications.removeNotification(db, requireAuth(c).identity, c.req.valid('param').id);
      return c.body(null, 204);
    },
  );

  return app;
}
