// The entry apps/web's route handler imports. `server-only` makes Next fail the build if a client
// component ever pulls the server in (ImBackendImplementationPlan P1-03). It throws outside Next's
// server layer, which is why it lives here and not in the package's main entry.
import 'server-only';

import { handle } from 'hono/vercel';
import { ConfigError, isProductionBuild } from './config';
import { getApi } from './http/singleton';

/**
 * Handles every /api/v1 request. If the API cannot start (most often a missing or invalid
 * environment variable), development gets the reason as JSON instead of a bare 500, because route
 * handler errors otherwise only appear in the terminal running `next dev`. Production returns
 * the generic envelope and logs the cause.
 */
export async function handleApiRequest(request: Request): Promise<Response> {
  try {
    return await handle(getApi())(request);
  } catch (error) {
    const detail = error instanceof ConfigError ? error.problems : [String(error)];
    console.error('[api] failed to start', detail);
    const body =
      isProductionBuild()
        ? { error: { code: 'INTERNAL', message: 'The service is unavailable.', details: null, request_id: null } }
        : { error: { code: 'INTERNAL', message: 'The API failed to start.', details: detail, request_id: null } };
    return Response.json(body, { status: 500 });
  }
}

export { getApi };
