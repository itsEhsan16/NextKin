import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import type { Flags } from '../../flags/flags';
import type { ApiEnv } from '../env';
import { checked } from '../respond';

/**
 * Which app versions the server still serves, and the newest one in the store (toreview §245).
 * Store builds can't be updated from here, so the app reads this on launch and on return to the
 * foreground: below `minimum` it shows a screen that only offers the update (every other request
 * answers 426 anyway, P3-07); below `latest` it offers the update once and can be dismissed.
 * Both come from app_settings (`clients.minimum_version`, `clients.latest_version`), so raising
 * them after a release is a settings change, not a deploy. Public: a signed-out phone needs it too.
 */
const versionSchema = z.object({
  minimum: z.string().nullable(),
  latest: z.string().nullable(),
});

const route = createRoute({
  method: 'get',
  path: '/app/version',
  tags: ['health'],
  summary: 'The oldest supported and the newest store version for a platform. Public, no PII.',
  request: { query: z.object({ platform: z.enum(['ios', 'android']) }) },
  responses: {
    200: { description: 'The versions.', content: { 'application/json': { schema: versionSchema } } },
  },
});

export function appVersionRoutes(flags: Flags): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  app.openapi(route, async (c) => {
    const { platform } = c.req.valid('query');
    const [minimum, latest] = await Promise.all([flags.minimumClientVersion(platform), flags.latestClientVersion(platform)]);
    // A setting changed in the admin is live within the flags' own cache; nothing between may hold it.
    c.header('Cache-Control', 'no-store');
    return c.json(checked(versionSchema, { minimum, latest }), 200);
  });
  return app;
}
