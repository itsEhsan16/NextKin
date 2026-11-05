import { createRoute, OpenAPIHono, z, type RouteConfig } from '@hono/zod-openapi';
import type { Context } from 'hono';

import { adminEnrollSchema, adminLoginSchema, adminReauthSchema, adminSetPasswordSchema, adminSignInStepSchema } from '@nextkin/shared/schemas/auth';

import { authErrorToApp } from '../../auth/service';
import type { StaffAuth, StaffStep } from '../../auth/staff/service';
import type { ApiEnv } from '../env';
import { errors } from '../errors';
import { trustedOrigins } from '../origins';
import { checked } from '../respond';
import { assertSameOriginForWeb, requestMeta } from './auth';
import { commonErrors } from './common';

/**
 * Staff sign-in over HTTP (toreview §171.13): `/auth/admin/login`, then `enroll` (first sign-in:
 * set up the authenticator) and `password` (replace a temporary password), each answering with the
 * next step. Web only, from our own origin. `reauth` proves the authenticator again on a session.
 */
export interface StaffAuthRouteDeps {
  staff: StaffAuth;
  appOrigin: string;
  extraOrigins?: readonly string[];
}

const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const step = { 200: { description: 'The next step, or the session.', content: { 'application/json': { schema: adminSignInStepSchema } } } };
const authErrors = { 401: { description: 'Wrong email, password or code.' }, 403: { description: 'Not allowed from this network.' }, 422: { description: 'Invalid input.' } };
const route = <R extends RouteConfig>(config: R) => createRoute({ tags: ['auth'], ...config });

export function staffAuthRoutes(deps: StaffAuthRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const trusted = trustedOrigins(deps.appOrigin, deps.extraOrigins);

  /** The session cookie travels as a header; the body says only what comes next. */
  const answer = (c: Context<ApiEnv>, result: StaffStep) => {
    if (result.status !== 'signed_in') return c.json(checked(adminSignInStepSchema, result), 200);
    const { cookie, ...body } = result;
    c.header('Set-Cookie', cookie);
    return c.json(checked(adminSignInStepSchema, body), 200);
  };

  app.openapi(
    route({
      method: 'post',
      path: '/auth/admin/login',
      summary: 'Staff sign-in: password, then the authenticator code or a backup code. Web only; not the users’ identity provider.',
      request: { body: json(adminLoginSchema) },
      responses: { ...step, ...authErrors, ...commonErrors },
    }),
    async (c) => {
      assertSameOriginForWeb(c, 'web', trusted);
      const { email, password, totp } = c.req.valid('json');
      const result = await deps.staff.signIn({ email, password, ...(totp ? { code: totp } : {}) }, requestMeta(c)).catch(authErrorToApp);
      return answer(c, result);
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/admin/enroll',
      summary: 'First staff sign-in: confirm the new authenticator with one code. Answers with backup codes and the next step.',
      request: { body: json(adminEnrollSchema) },
      responses: { ...step, ...authErrors, ...commonErrors },
    }),
    async (c) => {
      assertSameOriginForWeb(c, 'web', trusted);
      return answer(c, await deps.staff.confirmEnrollment(c.req.valid('json'), requestMeta(c)).catch(authErrorToApp));
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/admin/password',
      summary: 'Replace a temporary staff password (first sign-in or after a reset), then sign in.',
      request: { body: json(adminSetPasswordSchema) },
      responses: { ...step, ...authErrors, ...commonErrors },
    }),
    async (c) => {
      assertSameOriginForWeb(c, 'web', trusted);
      return answer(c, await deps.staff.setPassword(c.req.valid('json'), requestMeta(c)).catch(authErrorToApp));
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/admin/reauth',
      summary: 'Prove the authenticator again on this staff session, for a sensitive action.',
      request: { body: json(adminReauthSchema) },
      responses: { 204: { description: 'Proven.' }, ...authErrors, ...commonErrors },
    }),
    async (c) => {
      const auth = c.get('auth');
      if (!auth?.sessionId) throw errors.unauthenticated();
      if (!auth.staff) throw errors.forbidden(); // only a staff sign-in has an authenticator to prove
      await deps.staff.reauthenticate(auth.sessionId, auth.staff.accountId, c.req.valid('json').code);
      return c.body(null, 204);
    },
  );

  return app;
}
