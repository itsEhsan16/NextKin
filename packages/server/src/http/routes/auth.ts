import { createRoute, OpenAPIHono, z, type RouteConfig } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { sql } from 'kysely';
import { acceptedSchema, adminLoginSchema, changePasswordSchema, confirmSchema, emailOnlySchema, loginSchema, mobileSessionSchema, resetPasswordSchema, sessionSchema, signUpSchema } from '@nextkin/shared/schemas/auth';
import { AuthError, type IdentityProvider } from '../../auth/ports/identity';
import { authErrorToApp, type AuthService } from '../../auth/service';
import { clearSessionCookie, readSessionCookie, type SessionMeta, type SessionStore } from '../../auth/sessions';
import type { Database } from '../../db/database';
import type { ApiEnv } from '../env';
import { errors } from '../errors';
import { requireAuth } from '../middleware/guards';
import { trustedOrigins, type OriginCheck } from '../origins';
import { checked } from '../respond';
import { removeAllDevices } from '../../services/push';
import { authErrors, commonErrors } from './common';

/**
 * Password and session routes under /api/v1/auth (spec §11; ImBackendImplementationPlan P4-08).
 * Answers never reveal whether an account exists. A web sign-in must come from the app's own
 * origin (login CSRF). Logout and sign-out-everywhere delete the server sessions, so the very next
 * request with the old cookie or token is 401.
 */

export interface AuthRouteDeps {
  db: Database;
  idp: IdentityProvider;
  auth: AuthService;
  sessions: SessionStore;
  appOrigin: string;
  /** Origins besides `appOrigin` a web sign-in may come from, locally (toreview §131.10). */
  extraOrigins?: readonly string[];
}

const json = <S extends z.ZodType>(schema: S) => ({
  required: true,
  content: { 'application/json': { schema } },
});
const ok = <S extends z.ZodType>(description: string, schema: S) => ({
  description,
  content: { 'application/json': { schema } },
});
const route = <R extends RouteConfig>(config: R) => createRoute({ tags: ['auth'], ...config });

/** Login CSRF: a web sign-in that is not from our own origin is refused. */
export function assertSameOriginForWeb(c: Context<ApiEnv>, client: string, trusted: OriginCheck): void {
  if (client !== 'web') return;
  const origin = c.req.header('origin');
  const sameOrigin = origin ? trusted(origin) : c.req.header('sec-fetch-site') === 'same-origin';
  if (!sameOrigin) throw errors.forbidden();
}

/** A readable system name for the sessions list ("Mac", "iPhone"), from the user agent or X-Client. */
function platformName(ua: string, client: string | null): string {
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  if (client === 'ios') return 'iPhone';
  if (client === 'android') return 'Android';
  return 'Unknown';
}

export function requestMeta(c: Context<ApiEnv>): SessionMeta & { ip: string; requestId: string; userAgent?: string } {
  const ua = c.req.header('user-agent') ?? '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : undefined;
  const client = c.get('client');
  const mobileApp = client === 'ios' || client === 'android';
  return {
    platform: platformName(ua, client),
    // The native app has no browser; the row names the app instead.
    browser: mobileApp ? 'NextKin app' : browser,
    device: /iPad|Tablet/.test(ua) ? 'tablet' : mobileApp || /Mobile|iPhone|Android/.test(ua) ? 'phone' : 'desktop',
    ip: c.get('clientIp'),
    requestId: c.get('requestId'),
    userAgent: ua || undefined,
  };
}

export function authRoutes(deps: AuthRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const trusted = trustedOrigins(deps.appOrigin, deps.extraOrigins);
  const accepted = () => checked(acceptedSchema, { status: 'accepted' as const });

  app.openapi(
    route({
      method: 'post',
      path: '/auth/signup',
      summary: 'Start a sign-up; a code is emailed. Same answer whether or not the email is taken.',
      request: { body: json(signUpSchema) },
      responses: {
        202: ok('Check your email.', acceptedSchema),
        ...commonErrors,
      },
    }),
    async (c) => {
      await deps.idp.signUp(c.req.valid('json')).catch(authErrorToApp);
      return c.json(accepted(), 202);
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/confirm',
      summary: 'Confirm the emailed code.',
      request: { body: json(confirmSchema) },
      responses: { 204: { description: 'Confirmed.' }, ...commonErrors },
    }),
    async (c) => {
      const { email, code } = c.req.valid('json');
      await deps.idp.confirmSignUp(email, code).catch(authErrorToApp);
      return c.body(null, 204);
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/resend',
      summary: 'Send a new confirmation code.',
      request: { body: json(emailOnlySchema) },
      responses: {
        202: ok('Sent if applicable.', acceptedSchema),
        ...commonErrors,
      },
    }),
    async (c) => {
      await deps.idp.resendCode(c.req.valid('json').email);
      return c.json(accepted(), 202);
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/login',
      summary: 'Password sign-in. Web gets a session cookie; mobile gets tokens.',
      request: { body: json(loginSchema) },
      responses: {
        200: ok('Signed in.', z.union([sessionSchema, mobileSessionSchema])),
        ...authErrors,
        ...commonErrors,
      },
    }),
    async (c) => {
      const { email, password, client } = c.req.valid('json');
      assertSameOriginForWeb(c, client, trusted);
      const result = await deps.idp
        .signIn({
          email,
          password,
          pool: 'users',
          clientId: `nextkin-${client}`,
        })
        .catch(authErrorToApp);
      const signedIn = await deps.auth.complete(result, client, requestMeta(c)).catch(authErrorToApp);
      if (signedIn.cookie) c.header('Set-Cookie', signedIn.cookie);
      return c.json(
        signedIn.tokens
          ? checked(mobileSessionSchema, {
              user: signedIn.user,
              tokens: signedIn.tokens,
            })
          : checked(sessionSchema, { user: signedIn.user }),
        200,
      );
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/admin/login',
      summary: 'Staff sign-in (admins pool): password plus TOTP. Web only.',
      request: { body: json(adminLoginSchema) },
      responses: {
        200: ok('Signed in.', sessionSchema),
        ...authErrors,
        ...commonErrors,
      },
    }),
    async (c) => {
      const { email, password, totp } = c.req.valid('json');
      assertSameOriginForWeb(c, 'web', trusted);
      const result = await deps.idp
        .signIn({
          email,
          password,
          totp,
          pool: 'admins',
          clientId: 'nextkin-admin',
        })
        .catch(authErrorToApp);
      const signedIn = await deps.auth.complete(result, 'web', requestMeta(c)).catch(authErrorToApp);
      c.header('Set-Cookie', signedIn.cookie!);
      return c.json(checked(sessionSchema, { user: signedIn.user }), 200);
    },
  );

  app.openapi(
    route({
      method: 'get',
      path: '/auth/session',
      summary: 'Who is signed in.',
      responses: {
        200: ok('The session user.', sessionSchema),
        ...authErrors,
        ...commonErrors,
      },
    }),
    async (c) => {
      const { identity } = requireAuth(c);
      return c.json(
        checked(sessionSchema, {
          user: await deps.auth.userFor(identity.userId),
        }),
        200,
      );
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/logout',
      summary: 'End this session now (cookie or bearer).',
      responses: { 204: { description: 'Signed out.' }, ...commonErrors },
    }),
    async (c) => {
      const auth = c.get('auth');
      const cookieId = readSessionCookie(c.req.header('cookie'));
      const bearer = c.req.header('authorization')?.startsWith('Bearer ') ? await deps.idp.verifyAccessToken(c.req.header('authorization')!.slice(7)).catch(() => null) : null;
      const id = auth?.via === 'cookie' ? cookieId : bearer?.sessionRef;
      if (id) {
        const record = await deps.sessions.destroy(id);
        if (record) {
          await deps.idp.revokeSession(record.sessionRef);
          await deps.auth.securityEvent(record.userId, 'sign_out', requestMeta(c));
        }
      }
      c.header('Set-Cookie', clearSessionCookie());
      return c.body(null, 204);
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/logout-all',
      summary: 'Sign out everywhere: every session of this user, on every device.',
      responses: {
        204: { description: 'Signed out everywhere.' },
        ...authErrors,
        ...commonErrors,
      },
    }),
    async (c) => {
      const { identity } = requireAuth(c);
      const sub = await subFor(deps.db, identity.userId);
      for (const record of await deps.sessions.destroyAllForUser(identity.userId)) await deps.idp.revokeSession(record.sessionRef);
      if (sub) await deps.idp.globalSignOut(sub);
      await deps.db.withUser(identity, (tx) => removeAllDevices(tx, identity.userId));
      await deps.auth.securityEvent(identity.userId, 'sign_out_all', requestMeta(c));
      c.header('Set-Cookie', clearSessionCookie());
      return c.body(null, 204);
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/logout-others',
      summary: 'Sign out every other session of this user; this one stays signed in.',
      responses: {
        204: { description: 'Other sessions ended.' },
        ...authErrors,
        ...commonErrors,
      },
    }),
    async (c) => {
      const { identity, sessionId } = requireAuth(c);
      const ended = await deps.sessions.destroyAllForUser(identity.userId, sessionId);
      for (const record of ended) await deps.idp.revokeSession(record.sessionRef);
      await deps.auth.securityEvent(identity.userId, 'sign_out_others', requestMeta(c));
      return c.body(null, 204);
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/password/forgot',
      summary: 'Email a reset code. Same answer whether or not the account exists.',
      request: { body: json(emailOnlySchema) },
      responses: {
        202: ok('Sent if applicable.', acceptedSchema),
        ...commonErrors,
      },
    }),
    async (c) => {
      await deps.idp.forgotPassword(c.req.valid('json').email);
      return c.json(accepted(), 202);
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/password/reset',
      summary: 'Set a new password with the emailed code. Ends every session.',
      request: { body: json(resetPasswordSchema) },
      responses: { 204: { description: 'Password changed.' }, ...commonErrors },
    }),
    async (c) => {
      const { email, code, password } = c.req.valid('json');
      await deps.idp.confirmForgotPassword(email, code, password).catch(authErrorToApp);
      const user = await deps.db.withSystem('auth: end sessions after a password reset', (tx) =>
        tx
          .updateTable('users')
          .set({ password_changed_at: sql`now()` })
          .where('email', '=', email.trim().toLowerCase())
          .returning('id')
          .executeTakeFirst(),
      );
      if (user) {
        await deps.sessions.destroyAllForUser(user.id);
        await deps.auth.securityEvent(user.id, 'password_reset', requestMeta(c));
      }
      return c.body(null, 204);
    },
  );

  app.openapi(
    route({
      method: 'post',
      path: '/auth/password/change',
      summary: 'Change the password (needs the current one). Ends every other session.',
      request: { body: json(changePasswordSchema) },
      responses: {
        204: { description: 'Password changed.' },
        ...authErrors,
        ...commonErrors,
      },
    }),
    async (c) => {
      const { identity, via } = requireAuth(c);
      const { current, next } = c.req.valid('json');
      const sub = await subFor(deps.db, identity.userId);
      if (!sub) throw errors.unauthenticated();
      // A wrong current password is a field error, not a 401: a 401 tells clients the session is
      // gone and signs them out.
      await deps.idp.changePassword(sub, current, next).catch((error) => {
        if (error instanceof AuthError && error.failure === 'invalid_credentials') {
          throw errors.validation({ current: 'incorrect' }, 'Your current password is not right.');
        }
        return authErrorToApp(error);
      });
      const keep = via === 'cookie' ? (readSessionCookie(c.req.header('cookie')) ?? undefined) : undefined;
      await deps.sessions.destroyAllForUser(identity.userId, keep);
      await deps.db.withUser(identity, (tx) =>
        tx
          .updateTable('users')
          .set({ password_changed_at: sql`now()` })
          .where('id', '=', identity.userId)
          .execute(),
      );
      await deps.auth.securityEvent(identity.userId, 'password_changed', requestMeta(c));
      return c.body(null, 204);
    },
  );

  return app;
}

export async function subFor(db: Database, userId: string): Promise<string | null> {
  const row = await db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('users').select('identity_sub').where('id', '=', userId).executeTakeFirst());
  return row?.identity_sub ?? null;
}
