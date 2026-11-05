import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { requireStaff } from '../../services/admin/permissions';
import * as staffAccounts from '../../services/admin/staff';
import * as settings from '../../services/admin/staffSettings';
import type { ApiEnv } from '../env';
import { errors } from '../errors';
import type { AdminRouteDeps } from './admin';
import { admin, auditMeta, errs, idParam, json, ok, requireRecentMfa, staffOnly } from './adminKit';

/**
 * Staff & roles and Settings (toreview §171.13). Inviting, resetting and re-roling staff, and the
 * access policy, are Super Admin only (`roles.assign`) and need a recently proven authenticator
 * when the policy asks for one. A member's own authenticator and backup codes are theirs to manage,
 * whatever their role.
 */

const level = z.enum(['support', 'curator', 'admin', 'super_admin']);
const network = z.object({ cidr: z.string().min(2).max(64), label: z.string().max(60) }).strict();

export function adminStaffRoutes(deps: AdminRouteDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  app.use('/admin/*', staffOnly);
  const { db } = deps;
  const accountDeps = { db, ...(deps.sessions ? { sessions: deps.sessions } : {}), ...(deps.email ? { email: deps.email } : {}), ...(deps.appOrigin ? { appOrigin: deps.appOrigin } : {}) };
  const roles = admin('roles.assign');
  const staffAuth = () => {
    if (!deps.staff) throw errors.unavailable('Staff sign-in isn’t available right now.');
    return deps.staff;
  };
  const ownAccount = (c: Parameters<typeof requireStaff>[0]) => {
    const account = c.get('auth')?.staff?.accountId;
    if (!account) throw errors.forbidden(); // a staff session not from a staff sign-in
    return account;
  };

  // --- Staff & roles ---------------------------------------------------------------------------
  app.openapi(createRoute({ method: 'get', path: '/admin/staff', tags: ['admin'], summary: roles.describe('Staff accounts: role, authenticator, last active'), responses: { 200: ok('Staff.'), ...errs } }), async (c) =>
    c.json({ data: await staffAccounts.listStaff(db, requireStaff(c, 'roles.assign')) }, 200),
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/admin/staff',
      tags: ['admin'],
      summary: roles.describe('Invite a staff member: a temporary password, emailed and shown once'),
      request: { body: json(z.object({ name: z.string().trim().min(1).max(120), email: z.email().max(254), role: level }).strict()) },
      responses: { 201: ok('The invited member and their temporary password.'), ...errs },
    }),
    async (c) => {
      const staff = requireStaff(c, 'roles.assign');
      await requireRecentMfa(c, db);
      return c.json(await staffAccounts.inviteStaff(accountDeps, staff, c.req.valid('json'), auditMeta(c)), 201);
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/admin/staff/{id}/reset', tags: ['admin'], summary: roles.describe('Reset a member’s sign-in: a new temporary password, authenticator removed'), request: { params: idParam }, responses: { 200: ok('The temporary password.'), ...errs } }),
    async (c) => {
      const staff = requireStaff(c, 'roles.assign');
      await requireRecentMfa(c, db);
      return c.json(await staffAccounts.resetStaff(accountDeps, staff, c.req.valid('param').id, auditMeta(c)), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'put', path: '/admin/staff/{id}/role', tags: ['admin'], summary: roles.describe('Set a staff member’s role'), request: { params: idParam, body: json(z.object({ role: level }).strict()) }, responses: { 200: ok('The role.'), ...errs } }),
    async (c) => {
      const staff = requireStaff(c, 'roles.assign');
      await requireRecentMfa(c, db);
      return c.json(await staffAccounts.setStaffRole(accountDeps, staff, c.req.valid('param').id, c.req.valid('json').role, auditMeta(c)), 200);
    },
  );

  app.openapi(createRoute({ method: 'get', path: '/admin/staff/names', tags: ['admin'], summary: 'Staff names by user id, for the audit log (any staff role)', responses: { 200: ok('Names.'), ...errs } }), async (c) =>
    c.json({ data: await staffAccounts.staffNames(db, requireStaff(c, 'analytics.read')) }, 200),
  );

  // --- Settings --------------------------------------------------------------------------------
  app.openapi(createRoute({ method: 'get', path: '/admin/settings', tags: ['admin'], summary: 'The access policy, and your own authenticator and backup codes (any staff role)', responses: { 200: ok('Settings.'), ...errs } }), async (c) => {
    const staff = requireStaff(c, 'analytics.read');
    return c.json(await settings.readSettings(db, staff, c.get('auth')?.staff?.accountId, c.get('clientIp') ?? null), 200);
  });

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/admin/settings',
      tags: ['admin'],
      summary: roles.describe('Change the access policy: idle timeout, re-authentication, allowed networks'),
      request: { body: json(z.object({ sessionTimeoutMinutes: z.number().int().optional(), reauthForSensitive: z.boolean().optional(), allowedNetworks: z.array(network).max(50).optional() }).strict()) },
      responses: { 200: ok('Settings.'), ...errs },
    }),
    async (c) => {
      const staff = requireStaff(c, 'roles.assign');
      await requireRecentMfa(c, db);
      const ip = c.get('clientIp') ?? null;
      await settings.updateSettings(db, staff, c.req.valid('json'), ip, auditMeta(c));
      return c.json(await settings.readSettings(db, staff, c.get('auth')?.staff?.accountId, ip), 200);
    },
  );

  app.openapi(createRoute({ method: 'post', path: '/admin/settings/backup-codes', tags: ['admin'], summary: 'Replace your backup codes: ten new ones, shown once (any staff role)', responses: { 200: ok('The codes.'), ...errs } }), async (c) => {
    const staff = requireStaff(c, 'analytics.read');
    await requireRecentMfa(c, db);
    return c.json({ codes: await settings.regenerateBackupCodes(db, staffAuth(), staff, ownAccount(c), auditMeta(c)) }, 200);
  });

  app.openapi(createRoute({ method: 'post', path: '/admin/settings/authenticator', tags: ['admin'], summary: 'Start replacing your authenticator: a new secret to scan (any staff role)', responses: { 200: ok('The secret to scan.'), ...errs } }), async (c) => {
    requireStaff(c, 'analytics.read');
    await requireRecentMfa(c, db);
    return c.json(await staffAuth().beginReplacement(ownAccount(c)), 200);
  });

  app.openapi(
    createRoute({
      method: 'post',
      path: '/admin/settings/authenticator/confirm',
      tags: ['admin'],
      summary: 'Finish replacing your authenticator with one code from it; new backup codes follow (any staff role)',
      request: { body: json(z.object({ challenge: z.string().min(16).max(128), code: z.string().trim().regex(/^\d{6}$/) }).strict()) },
      responses: { 200: ok('New backup codes.'), ...errs },
    }),
    async (c) => {
      const staff = requireStaff(c, 'analytics.read');
      const { challenge, code } = c.req.valid('json');
      const result = await staffAuth().confirmReplacement(ownAccount(c), challenge, code);
      await settings.auditAuthenticatorReplaced(db, staff, auditMeta(c));
      return c.json(result, 200);
    },
  );

  return app;
}
