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
 * Sign-in through Clerk (owner, 2026-11-04, toreview §169; mobile §173). Clerk signs the user up
 * or in (its components in the browser, its hooks in the app); the client then posts its Clerk
 * session token here once. The server verifies it with Clerk, creates the user on first sight
 * (users.ts), and opens a server session: web gets the same `__Host-` cookie a password sign-in
 * gets; mobile's session is keyed by the Clerk session id its later bearer tokens name. Every
 * other route, RLS and logout are unchanged. Web is same-origin only (login CSRF), like /auth/login.
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
      summary: 'Exchange a Clerk session token for a server session (a cookie on web).',
      request: { body: { required: true, content: { 'application/json': { schema: clerkExchangeSchema } } } },
      responses: {
        200: { description: 'Signed in.', content: { 'application/json': { schema: sessionSchema } } },
        ...authErrors,
        ...commonErrors,
      },
    }),
    async (c) => {
      const { token, client } = c.req.valid('json');
      assertSameOriginForWeb(c, client, trusted);
      const result = await deps.clerk.exchange(token).catch(authErrorToApp);
      // Mobile (toreview §173): the server session is keyed by Clerk's session id, and the phone
      // proves itself on every request with a fresh Clerk token (the authenticator's bearer path),
      // so there is no cookie and no token of ours to hand back.
      const signedIn = await deps.auth.complete(result, client, requestMeta(c)).catch(authErrorToApp);
      if (signedIn.cookie) c.header('Set-Cookie', signedIn.cookie);
      return c.json(checked(sessionSchema, { user: signedIn.user }), 200);
    },
  );

  return app;
}
