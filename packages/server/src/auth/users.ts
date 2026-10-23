import { randomUUID } from 'node:crypto';
import type { Database, UserRole } from '../db/database';
import type { IdentityProfile } from './ports/identity';

/**
 * The application's mirror of an identity (spec §10: users keyed by the identity provider's `sub`,
 * created just in time; ImBackendImplementationPlan P4-05). Looking a sub up is a system operation —
 * RLS rightly hides every other user's row from the app role — so it runs through withSystem, and
 * the new user's rows are then created through withUser, under RLS like any other write.
 */

const STAFF_ROLES: UserRole[] = ['admin', 'curator', 'support'];

/** Role from the identity provider's groups (spec §9.4.1: groups at last sign-in). */
export function roleFrom(profile: IdentityProfile): UserRole {
  if (profile.pool !== 'admins') return 'user';
  return STAFF_ROLES.find((role) => profile.groups.includes(role)) ?? (profile.groups.includes('super_admin') ? 'admin' : 'support');
}

export interface ResolvedUser {
  userId: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'deleted';
  created: boolean;
}

export async function resolveUser(db: Database, profile: IdentityProfile): Promise<ResolvedUser> {
  const role = roleFrom(profile);
  const existing = await db.withSystem('auth: resolve identity to user', (tx) =>
    tx.selectFrom('users').select(['id', 'role', 'status', 'email_verified']).where('identity_sub', '=', profile.sub).executeTakeFirst(),
  );

  if (existing) {
    if (existing.role !== role || existing.email_verified !== profile.emailVerified) {
      await db.withSystem('auth: sync role and verification from the identity provider', (tx) =>
        tx.updateTable('users').set({ role, email_verified: profile.emailVerified }).where('id', '=', existing.id).execute(),
      );
    }
    return { userId: existing.id, role, status: existing.status as ResolvedUser['status'], created: false };
  }

  const userId = randomUUID();
  const [first, ...rest] = (profile.name ?? '').trim().split(/\s+/);
  await db.withUser({ userId, role }, async (tx) => {
    await tx
      .insertInto('users')
      .values({
        id: userId,
        identity_sub: profile.sub,
        email: profile.email,
        email_verified: profile.emailVerified,
        first_name: (first ?? '').slice(0, 100),
        last_name: rest.join(' ').slice(0, 100),
        role,
        mfa_enforced: profile.pool === 'admins',
      })
      .execute();
    await tx.insertInto('user_settings').values({ user_id: userId }).execute();
    await tx.insertInto('profiles').values({ user_id: userId }).execute();
  });
  return { userId, role, status: 'active', created: true };
}
