import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { clerkExchangeSchema, sessionSchema } from '@nextkin/shared/schemas/auth';
import type { ClerkIdentityProvider } from '../../auth/adapters/clerk/provider';
import { authErrorToApp, type AuthService } from '../../auth/service';
import type { ApiEnv } from '../env';
import { trustedOrigins } from '../origins';
import { checked } from '../respond';
import { assertSameOriginForWeb, requestMeta } from './auth';
import { authErrors, commonErrors } from './common';

/**
 * Web sign-in through Clerk (owner, 2026-11-04, toreview §169). Clerk's components sign the user
 * up or in inside the browser; the page then posts its Clerk session token here once. The server
 * verifies it with Clerk, creates the user on first sight (users.ts), and answers with the same
 * `__Host-` session cookie a password sign-in gets, so every other route, RLS and logout are
 * unchanged. Same-origin only (login CSRF), like /auth/login.
 */
export interface ClerkRouteDeps {
  clerk: ClerkIdentityProvider;
  auth: AuthService;
  appOrigin: string;
  extraOrigins?: readonly string[];
}

export function clerkAuthRoutes(deps: ClerkRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const trusted = trustedOrigins(deps.appOrigin, deps.extraOrigins);

  app.openapi(
    createRoute({
      tags: ['auth'],
      method: 'post',
      path: '/auth/clerk/exchange',
      summary: 'Exchange a Clerk session token for a web session cookie.',
      request: { body: { required: true, content: { 'application/json': { schema: clerkExchangeSchema } } } },
      responses: {
        200: { description: 'Signed in.', content: { 'application/json': { schema: sessionSchema } } },
        ...authErrors,
        ...commonErrors,
      },
    }),
    async (c) => {
      assertSameOriginForWeb(c, 'web', trusted);
      const result = await deps.clerk.exchange(c.req.valid('json').token).catch(authErrorToApp);
      const signedIn = await deps.auth.complete(result, 'web', requestMeta(c)).catch(authErrorToApp);
      c.header('Set-Cookie', signedIn.cookie!);
      return c.json(checked(sessionSchema, { user: signedIn.user }), 200);
    },
  );

  return app;
}
