import { z } from '@hono/zod-openapi';
import type { Context, MiddlewareHandler } from 'hono';

import { networkAllows } from '../../auth/staff/networks';
import { readAdminPolicy } from '../../auth/staff/service';
import type { Database } from '../../db/database';
import { levelOf, PERMISSIONS, type Permission } from '../../services/admin/permissions';
import type { ApiEnv } from '../env';
import { AppError, errors } from '../errors';
import { commonErrors, notFoundError } from './common';

/**
 * The pieces every admin route file shares (`admin.ts` and the per-area files beside it). Each area
 * of the admin portal mounts its own routes file, so areas can be built and reviewed apart; all of
 * them check the permission inside each handler with `requireStaff` (`services/admin/permissions.ts`).
 */

export const ok = (description: string) => ({ description, content: { 'application/json': { schema: z.unknown() } } });
export const json = <S extends z.ZodType>(schema: S) => ({ required: true, content: { 'application/json': { schema } } });
export const errs = { 401: { description: 'Not signed in.' }, 403: { description: 'Not permitted for this role.' }, ...notFoundError, ...commonErrors };
export const idParam = z.object({ id: z.string().max(100) });
export const auditMeta = (c: Context<ApiEnv>) => ({ ip: c.get('clientIp') ?? null, requestId: c.get('requestId') ?? null });

/** A route's permission, written into its OpenAPI summary so the contract says who may call it. */
export function admin<P extends Permission>(permission: P) {
  return { permission, describe: (s: string) => `${s} (needs ${permission}: ${PERMISSIONS[permission].join(', ')})` };
}

/** Staff only, before any request is validated: anonymous is 401 and a user session 403. */
export const staffOnly: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const auth = c.get('auth');
  if (!auth) throw errors.unauthenticated();
  if (!levelOf(auth)) throw errors.forbidden();
  await next();
};

/** Tests and laptops only; config refuses a placeholder STAFF_TOTP_KEY in shared environments. */
export const LOCAL_STAFF_KEY = 'local-staff-totp-key-not-for-shared-environments';

/**
 * Settings › Access › Allowed networks, on every admin request (sign-in checks it too). The policy
 * is read at most every 30 seconds per process, so a change applies within half a minute.
 */
export function staffNetworkGuard(db: Database): MiddlewareHandler<ApiEnv> {
  let cached: { at: number; policy: Awaited<ReturnType<typeof readAdminPolicy>> } | null = null;
  return async (c, next) => {
    if (!c.get('auth')) return next(); // anonymous: the routes answer 401
    if (!cached || Date.now() - cached.at > 30_000) cached = { at: Date.now(), policy: await readAdminPolicy(db) };
    if (!networkAllows(cached.policy.allowedNetworks, c.get('clientIp'))) {
      throw new AppError('FORBIDDEN', 'The admin portal isn’t available from this network.', { network: true });
    }
    await next();
  };
}

/** How long a proven authenticator covers sensitive actions, when Settings asks for re-authentication. */
export const REAUTH_MINUTES = 15;

/**
 * Sensitive staff actions (inviting or resetting staff, roles, the access policy) need the
 * authenticator proven within the last 15 minutes when "Re-authenticate for sensitive actions" is
 * on. The portal answers `reauthRequired` by asking for a code (`POST /auth/admin/reauth`) and
 * retrying.
 */
export async function requireRecentMfa(c: Context<ApiEnv>, db: Database): Promise<void> {
  const policy = await readAdminPolicy(db);
  if (!policy.reauthForSensitive) return;
  const staff = c.get('auth')?.staff;
  if (staff && Date.now() - staff.mfaAt <= REAUTH_MINUTES * 60_000) return;
  throw new AppError('FORBIDDEN', 'Confirm it’s you: enter a code from your authenticator.', { reauthRequired: true });
}
