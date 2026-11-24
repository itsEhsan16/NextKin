import { randomUUID } from 'node:crypto';
import type { Database, UserRole } from '../db/database';
import { AuthError, type IdentityProfile } from './ports/identity';

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
  /** An existing account (same verified email) took this new sub: a Google sign-in, or a new Clerk instance. */
  linked: boolean;
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
    return { userId: existing.id, role, status: existing.status as ResolvedUser['status'], created: false, linked: false };
  }

  // Linking by email (V2 §7.1; owner, 2026-11-24). A sub we have never seen whose email already has an
  // account: the same person arriving by Google, or every user after the move to Clerk's production
  // instance (new user ids). The provider must vouch for the email; staff never link this way. `email`
  // is citext, so the match ignores case.
  const sameEmail = await db.withSystem('auth: find an account with the same email', (tx) =>
    tx.selectFrom('users').select(['id', 'status']).where('email', '=', profile.email).executeTakeFirst(),
  );
  if (sameEmail) {
    if (!profile.emailVerified || profile.pool === 'admins' || role !== 'user' || sameEmail.status === 'deleted') {
      throw new AuthError('email_in_use', 'an account with this email exists and cannot be linked');
    }
    const moved = await db.withSystem('auth: link a verified email to its account', (tx) =>
      tx
        .updateTable('users')
        .set({ identity_sub: profile.sub, email_verified: true })
        .where('id', '=', sameEmail.id)
        .where('role', '=', 'user')
        .returning('id')
        .executeTakeFirst(),
    );
    if (!moved) throw new AuthError('email_in_use', 'a staff account cannot be linked by email');
    return { userId: sameEmail.id, role, status: sameEmail.status as ResolvedUser['status'], created: false, linked: true };
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
  return { userId, role, status: 'active', created: true, linked: false };
}
