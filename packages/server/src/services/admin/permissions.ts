import type { Context } from 'hono';

import type { Identity } from '../../db/database';
import type { ApiEnv, Authenticated } from '../../http/env';
import { errors } from '../../http/errors';

/**
 * Admin roles and what each may do (ImBackendImplementationPlan P12-01; spec §7.17), enforced on the
 * server for every admin route. Roles come from the admin pool's groups at sign-in; Super Admin is
 * an application permission on an admin (§9.4.2).
 *
 * - Super Admin: everything, including role assignment and provider keys.
 * - Admin: user and content operations, plans, providers (not their keys).
 * - Content Curator: the KB, prompts, templates and support content; no user PII.
 * - Support: read-mostly user assistance (search and inspect accounts, the audit log).
 */

export type StaffLevel = 'support' | 'curator' | 'admin' | 'super_admin';

export const PERMISSIONS = {
  'users.read': ['support', 'admin', 'super_admin'],
  'users.manage': ['admin', 'super_admin'],
  'users.content': ['admin', 'super_admin'],
  'roles.assign': ['super_admin'],
  'audit.read': ['support', 'admin', 'super_admin'],
  'content.manage': ['curator', 'admin', 'super_admin'],
  'plans.manage': ['admin', 'super_admin'],
  'providers.manage': ['admin', 'super_admin'],
  'providers.keys': ['super_admin'],
  'analytics.read': ['support', 'curator', 'admin', 'super_admin'],
} as const satisfies Record<string, readonly StaffLevel[]>;

export type Permission = keyof typeof PERMISSIONS;

export function levelOf(auth: Authenticated | null): StaffLevel | null {
  if (!auth) return null;
  const role = auth.identity.role;
  if (role === 'admin') return auth.superAdmin ? 'super_admin' : 'admin';
  if (role === 'curator' || role === 'support') return role;
  return null;
}

export const can = (level: StaffLevel | null, permission: Permission) => level !== null && (PERMISSIONS[permission] as readonly StaffLevel[]).includes(level);

export interface Staff {
  identity: Identity;
  level: StaffLevel;
}

/** The role a staff member's database session runs as (Super Admin is an admin to Postgres). */
export const dbRole = (staff: Staff): 'admin' | 'curator' | 'support' => (staff.level === 'super_admin' ? 'admin' : staff.level);

/** 401 without a session; 403 for anyone whose role does not hold the permission. */
export function requireStaff(c: Context<ApiEnv>, permission: Permission): Staff {
  const auth = c.get('auth');
  if (!auth) throw errors.unauthenticated();
  const level = levelOf(auth);
  if (!can(level, permission)) throw errors.forbidden();
  return { identity: { userId: auth.identity.userId, role: auth.identity.role }, level: level! };
}
