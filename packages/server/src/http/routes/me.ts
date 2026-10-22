import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { pageQuerySchema, pageSchema } from '@nextkin/shared/schemas/page';
import {
  appSettingsPatchSchema,
  appSettingsSchema,
  privacySettingsPatchSchema,
  privacySettingsSchema,
  profileLinkInputSchema,
  profileLinkSchema,
} from '@nextkin/shared/schemas/settings';
import type { IdempotencyStore } from '../../cache/stores';
import type { Database } from '../../db/database';
import { createLink, deleteLink, listLinks } from '../../services/links';
import { getSettings, updateSettings } from '../../services/settings';
import type { ApiEnv } from '../env';
import { etagFor, requireIfMatch } from '../etag';
import { idempotent, requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { authErrors, commonErrors, notFoundError, writeErrors } from './common';

/**
 * The signed-in user's own resources. P3 ships settings and profile links: together they use
 * every link in the chain (auth, CSRF, rate limits, validation, ETag/If-Match, idempotency,
 * keyset pagination, response validation). P5 adds the rest of the account and profile.
 */

const settingsSchema = z.object({ appSettings: appSettingsSchema, privacySettings: privacySettingsSchema });
const settingsPatch = z
  .object({ appSettings: appSettingsPatchSchema.optional(), privacySettings: privacySettingsPatchSchema.optional() })
  .strict();
const etagHeader = { ETag: { description: 'The version to send back as If-Match.', schema: { type: 'string' as const } } };

const getSettingsRoute = createRoute({
  method: 'get',
  path: '/me/settings',
  tags: ['me'],
  summary: 'App and privacy settings.',
  responses: {
    200: { description: 'Current settings.', headers: etagHeader, content: { 'application/json': { schema: settingsSchema } } },
    ...authErrors,
    ...commonErrors,
  },
});

const patchSettingsRoute = createRoute({
  method: 'patch',
  path: '/me/settings',
  tags: ['me'],
  summary: 'Change some settings. Requires If-Match with the loaded ETag.',
  request: {
    headers: z.object({ 'if-match': z.string().optional() }),
    body: { required: true, content: { 'application/json': { schema: settingsPatch } } },
  },
  responses: {
    200: { description: 'Updated settings.', headers: etagHeader, content: { 'application/json': { schema: settingsSchema } } },
    ...authErrors,
    ...writeErrors,
    ...commonErrors,
  },
});

const listLinksRoute = createRoute({
  method: 'get',
  path: '/me/links',
  tags: ['me'],
  summary: 'Profile links, cursor-paginated.',
  request: { query: pageQuerySchema },
  responses: {
    200: { description: 'A page of links.', content: { 'application/json': { schema: pageSchema(profileLinkSchema) } } },
    ...authErrors,
    ...commonErrors,
  },
});

const createLinkRoute = createRoute({
  method: 'post',
  path: '/me/links',
  tags: ['me'],
  summary: 'Add a profile link. Honours Idempotency-Key.',
  request: {
    headers: z.object({ 'idempotency-key': z.string().optional() }),
    body: { required: true, content: { 'application/json': { schema: profileLinkInputSchema } } },
  },
  responses: {
    201: { description: 'The created link.', content: { 'application/json': { schema: profileLinkSchema } } },
    ...authErrors,
    ...notFoundError,
    ...writeErrors,
    ...commonErrors,
  },
});

const deleteLinkRoute = createRoute({
  method: 'delete',
  path: '/me/links/{id}',
  tags: ['me'],
  summary: 'Remove a profile link.',
  request: { params: z.object({ id: z.uuid() }) },
  responses: { 204: { description: 'Removed.' }, ...authErrors, ...notFoundError, ...commonErrors },
});

export interface MeDeps {
  db: Database;
  idempotency: IdempotencyStore;
  cursorSecret: string;
}

export function meRoutes(deps: MeDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();

  app.openapi(getSettingsRoute, async (c) => {
    const { identity } = requireAuth(c);
    const settings = await getSettings(deps.db, identity);
    c.header('ETag', etagFor(settings.rowVersion));
    return c.json(checked(settingsSchema, { appSettings: settings.appSettings, privacySettings: settings.privacySettings }), 200);
  });

  app.openapi(patchSettingsRoute, async (c) => {
    const { identity } = requireAuth(c);
    const current = await getSettings(deps.db, identity);
    requireIfMatch(c.req.valid('header')['if-match'], current.rowVersion);
    const updated = await updateSettings(deps.db, identity, current.rowVersion, c.req.valid('json'));
    c.header('ETag', etagFor(updated.rowVersion));
    return c.json(checked(settingsSchema, { appSettings: updated.appSettings, privacySettings: updated.privacySettings }), 200);
  });

  app.openapi(listLinksRoute, async (c) => {
    const { identity } = requireAuth(c);
    const { limit, cursor } = c.req.valid('query');
    const page = await listLinks(deps.db, identity, { limit, cursor, cursorSecret: deps.cursorSecret });
    return c.json(checked(pageSchema(profileLinkSchema), page), 200);
  });

  // Auth is checked first so an anonymous request never claims an idempotency key.
  app.use('/me/links', async (c, next) => {
    if (c.req.method === 'POST') requireAuth(c);
    await next();
  });
  app.on('POST', '/me/links', idempotent(deps.idempotency, { required: false }));
  app.openapi(createLinkRoute, async (c) => {
    const { identity } = requireAuth(c);
    const link = await createLink(deps.db, identity, c.req.valid('json'));
    return c.json(checked(profileLinkSchema, link), 201);
  });

  app.openapi(deleteLinkRoute, async (c) => {
    const { identity } = requireAuth(c);
    await deleteLink(deps.db, identity, c.req.valid('param').id);
    return c.body(null, 204);
  });

  return app;
}
