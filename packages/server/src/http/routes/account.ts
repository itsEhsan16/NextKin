import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import {
  accountSecuritySchema,
  activityEntrySchema,
  connectedAccountSchema,
  dashboardStatsSchema,
  emailChangeSchema,
  emailConfirmSchema,
  namePatchSchema,
  notificationPrefsSchema,
  notificationSettingsSchema,
  userSchema,
} from '@nextkin/shared/schemas/account';
import { acceptedSchema } from '@nextkin/shared/schemas/auth';
import { pageQuerySchema, pageSchema } from '@nextkin/shared/schemas/page';
import type { IdentityProvider } from '../../auth/ports/identity';
import { authErrorToApp } from '../../auth/service';
import type { Database } from '../../db/database';
import * as account from '../../services/account';
import type { ApiEnv } from '../env';
import { errors } from '../errors';
import { requireAuth } from '../middleware/guards';
import { checked } from '../respond';
import { subFor } from './auth';
import { authErrors, commonErrors, notFoundError } from './common';

/**
 * The account under `/api/v1/me` (ImBackendImplementationPlan P5-05, P5-06; the endpoints §11
 * never named, designed under C-05). Settings and links stay in me.ts (P3).
 */

export interface AccountDeps {
  db: Database;
  /** Signs the avatar for reads (P7); without it the user has no avatarUrl. */
  signAvatar?: account.AvatarSigner;
  cursorSecret: string;
  /** Email change and connected accounts go through the identity provider. */
  idp?: IdentityProvider;
}

const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
const ok = <S extends z.ZodType>(description: string, schema: S) => ({ description, content: { 'application/json': { schema } } });
const connectedList = z.object({ items: z.array(connectedAccountSchema) });

/**
 * A staff sign-in (toreview §171.13) has no account at the users' identity provider: its email and
 * sign-in are the server's own staff account, managed by a Super Admin, so these changes refuse.
 */
function notStaff(c: Context<ApiEnv>): void {
  if (c.get('auth')?.staff) throw errors.conflict('A staff account’s email and sign-in are managed by a Super Admin.');
}

export function accountRoutes(deps: AccountDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const { db } = deps;
  const idp = () => {
    if (!deps.idp) throw new Error('identity provider not configured');
    return deps.idp;
  };
  const sub = async (userId: string) => {
    const value = await subFor(db, userId);
    if (!value) throw errors.unauthenticated();
    return value;
  };

  app.openapi(
    createRoute({ method: 'get', path: '/me', tags: ['account'], summary: 'The signed-in user.', responses: { 200: ok('The user.', userSchema), ...authErrors, ...commonErrors } }),
    async (c) => c.json(checked(userSchema, await account.getUser(db, requireAuth(c).identity, deps.signAvatar)), 200),
  );

  app.openapi(
    createRoute({ method: 'patch', path: '/me', tags: ['account'], summary: 'Change the account name.', request: { body: json(namePatchSchema) }, responses: { 200: ok('The user.', userSchema), ...authErrors, ...commonErrors } }),
    async (c) => c.json(checked(userSchema, await account.updateName(db, requireAuth(c).identity, c.req.valid('json'), deps.signAvatar)), 200),
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/me/email',
      tags: ['account'],
      summary: 'Start an email change: a code goes to the new address; nothing changes until it is confirmed.',
      request: { body: json(emailChangeSchema) },
      responses: { 202: ok('Check the new inbox.', acceptedSchema), ...authErrors, ...commonErrors },
    }),
    async (c) => {
      const { identity } = requireAuth(c);
      notStaff(c);
      await idp().requestEmailChange(await sub(identity.userId), c.req.valid('json').email).catch(authErrorToApp);
      return c.json(checked(acceptedSchema, { status: 'accepted' as const }), 202);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/me/email/confirm',
      tags: ['account'],
      summary: 'Confirm the code sent to the new address; the email changes now.',
      request: { body: json(emailConfirmSchema) },
      responses: { 200: ok('The user, with the new email.', userSchema), ...authErrors, ...commonErrors },
    }),
    async (c) => {
      const { identity } = requireAuth(c);
      notStaff(c);
      const { email } = await idp().confirmEmailChange(await sub(identity.userId), c.req.valid('json').code).catch(authErrorToApp);
      return c.json(checked(userSchema, await account.setEmail(db, identity, email)), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'get', path: '/me/security', tags: ['account'], summary: 'Password age, two-factor, and the signed-in sessions (this one first).', responses: { 200: ok('Security.', accountSecuritySchema), ...authErrors, ...commonErrors } }),
    async (c) => {
      const { identity, sessionId } = requireAuth(c);
      return c.json(checked(accountSecuritySchema, await account.getSecurity(db, identity, sessionId ?? null)), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'get', path: '/me/dashboard', tags: ['account'], summary: 'The Home counters (C-11 definitions).', responses: { 200: ok('Counters.', dashboardStatsSchema), ...authErrors, ...commonErrors } }),
    async (c) => c.json(checked(dashboardStatsSchema, await account.getDashboardStats(db, requireAuth(c).identity)), 200),
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/me/activity',
      tags: ['account'],
      summary: 'The activity feed, newest first, cursor-paginated.',
      request: { query: pageQuerySchema },
      responses: { 200: ok('A page of activity.', pageSchema(activityEntrySchema)), ...authErrors, ...commonErrors },
    }),
    async (c) => {
      const { limit, cursor } = c.req.valid('query');
      const page = await account.listActivity(db, requireAuth(c).identity, { limit, cursor, cursorSecret: deps.cursorSecret });
      return c.json(checked(pageSchema(activityEntrySchema), page), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'get', path: '/me/connected-accounts', tags: ['account'], summary: 'Sign-in providers and whether each is linked.', responses: { 200: ok('Providers.', connectedList), ...authErrors, ...commonErrors } }),
    async (c) => {
      const { identity } = requireAuth(c);
      const items = account.connectedAccounts(await idp().listIdentities(await sub(identity.userId)));
      return c.json(checked(connectedList, { items }), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/me/connected-accounts/{provider}',
      tags: ['account'],
      summary: 'Unlink a provider. Refused (409) when it is the only way to sign in.',
      request: { params: z.object({ provider: z.enum(['google', 'apple']) }) },
      responses: { 200: ok('Providers.', connectedList), 409: { description: 'It is the only way to sign in.' }, ...authErrors, ...notFoundError, ...commonErrors },
    }),
    async (c) => {
      const { identity } = requireAuth(c);
      notStaff(c);
      const subject = await sub(identity.userId);
      await idp().unlinkIdentity(subject, c.req.valid('param').provider).catch(authErrorToApp);
      const items = account.connectedAccounts(await idp().listIdentities(subject));
      return c.json(checked(connectedList, { items }), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'get', path: '/me/notification-prefs', tags: ['account'], summary: 'Mobile notification categories (NOTIF 04).', responses: { 200: ok('Preferences.', notificationPrefsSchema), ...authErrors, ...commonErrors } }),
    async (c) => c.json(checked(notificationPrefsSchema, await account.notifications.getPrefs(db, requireAuth(c).identity)), 200),
  );
  app.openapi(
    createRoute({ method: 'put', path: '/me/notification-prefs', tags: ['account'], summary: 'Replace the mobile notification preferences.', request: { body: json(notificationPrefsSchema) }, responses: { 200: ok('Preferences.', notificationPrefsSchema), ...authErrors, ...commonErrors } }),
    async (c) => c.json(checked(notificationPrefsSchema, await account.notifications.setPrefs(db, requireAuth(c).identity, c.req.valid('json'))), 200),
  );
  app.openapi(
    createRoute({ method: 'get', path: '/me/notification-settings', tags: ['account'], summary: 'Web notification channels and topics.', responses: { 200: ok('Settings.', notificationSettingsSchema), ...authErrors, ...commonErrors } }),
    async (c) => c.json(checked(notificationSettingsSchema, await account.notifications.getSettings(db, requireAuth(c).identity)), 200),
  );
  app.openapi(
    createRoute({ method: 'put', path: '/me/notification-settings', tags: ['account'], summary: 'Replace the web notification settings whole.', request: { body: json(notificationSettingsSchema) }, responses: { 200: ok('Settings.', notificationSettingsSchema), ...authErrors, ...commonErrors } }),
    async (c) => c.json(checked(notificationSettingsSchema, await account.notifications.setSettings(db, requireAuth(c).identity, c.req.valid('json'))), 200),
  );
  app.openapi(
    createRoute({ method: 'post', path: '/me/notification-settings/reset', tags: ['account'], summary: 'Back to what a new account starts with.', responses: { 200: ok('Settings.', notificationSettingsSchema), ...authErrors, ...commonErrors } }),
    async (c) => c.json(checked(notificationSettingsSchema, await account.notifications.resetSettings(db, requireAuth(c).identity)), 200),
  );

  return app;
}
