import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';

import { hashPassword } from '../../auth/password';
import type { SessionStore } from '../../auth/sessions';
import type { Database } from '../../db/database';
import type { EmailPort } from '../../email/email';
import { errors } from '../../http/errors';
import { newTemporaryPassword } from '../../auth/staff/crypto';
import { writeAudit, type RequestMeta } from './audit';
import type { Staff, StaffLevel } from './permissions';

/**
 * Staff accounts as the Staff & roles page manages them (toreview §171.13). Only a Super Admin
 * invites, resets or re-roles (`roles.assign`, checked by the route); each change is audited in the
 * same transaction. An invite or a reset makes a temporary password: it is emailed to the member and
 * shown once to the Super Admin, and the first sign-in replaces it and sets up the authenticator.
 */

export interface StaffDeps {
  db: Database;
  sessions?: SessionStore;
  email?: EmailPort;
  appOrigin?: string;
}

export const STAFF_LEVELS: readonly StaffLevel[] = ['support', 'curator', 'admin', 'super_admin'];

const userRole = (level: StaffLevel) => (level === 'super_admin' ? 'admin' : level);

export interface StaffMemberWire {
  /** The member's user id: what the audit log and role changes name. */
  id: string;
  name: string;
  email: string;
  role: StaffLevel;
  mfa: 'totp' | 'none';
  lastActiveAt: string | null;
  status: 'active' | 'invited' | 'disabled';
}

export async function listStaff(db: Database, staff: Staff): Promise<StaffMemberWire[]> {
  const rows = await db.withSystem(`admin ${staff.identity.userId}: list staff`, (tx) =>
    tx
      .selectFrom('staff_accounts as s')
      .leftJoin(
        (eb) => eb.selectFrom('sessions').select(['user_id', sql<Date>`max(last_seen_at)`.as('seen')]).groupBy('user_id').as('seen'),
        (join) => join.onRef('seen.user_id', '=', 's.user_id'),
      )
      .select(['s.user_id', 's.name', 's.email', 's.role', 's.status', 's.totp_sealed', 's.last_sign_in_at', 'seen.seen'])
      .orderBy('s.created_at')
      .execute(),
  );
  return rows.map((row) => {
    const times = [row.last_sign_in_at, row.seen].filter((t): t is Date => t instanceof Date);
    const last = times.length ? new Date(Math.max(...times.map((t) => t.getTime()))) : null;
    return {
      id: row.user_id,
      name: row.name,
      email: row.email,
      role: row.role as StaffLevel,
      mfa: row.totp_sealed ? 'totp' : 'none',
      lastActiveAt: last ? last.toISOString() : null,
      status: row.status as StaffMemberWire['status'],
    };
  });
}

async function mailTemporaryPassword(deps: StaffDeps, to: string, name: string, password: string, why: 'invite' | 'reset') {
  if (!deps.email) return false;
  const portal = `${deps.appOrigin ?? ''}/admin/sign-in`;
  const opening = why === 'invite' ? `You've been invited to the NextKin admin portal.` : 'Your NextKin admin sign-in was reset.';
  await deps.email
    .send({
      to,
      subject: why === 'invite' ? 'Your NextKin staff account' : 'Your NextKin staff sign-in was reset',
      text: `Hi ${name},\n\n${opening}\n\nSign in at ${portal} with this temporary password:\n\n  ${password}\n\nYou'll set up an authenticator app and choose your own password the first time you sign in. The temporary password stops working once you do.\n\nIf you weren't expecting this, tell your NextKin admin.`,
    })
    .catch(() => undefined); // the Super Admin sees the password once either way
  return true;
}

/**
 * Creates a staff account with a temporary password: its users row (under its own identity, as
 * sign-up creates one), then the staff row and the audit row together. `by` is the Super Admin who
 * invited them; a bootstrap (`pnpm staff:create`) has none, and its row names the member themself.
 */
async function createStaffAccount(db: Database, input: { name: string; email: string; role: StaffLevel }, by: Staff | null, meta: RequestMeta) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 120);
  const taken = await db.withSystem('staff: check the email for a new staff account', async (tx) => ({
    user: await tx.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst(),
    staff: await tx.selectFrom('staff_accounts').select('id').where('email', '=', email).executeTakeFirst(),
  }));
  if (taken.staff) throw errors.conflict('That email already has a staff account.');
  // users.email is unique: a staff account needs an address no NextKin user account has.
  if (taken.user) throw errors.conflict('That email belongs to a NextKin user account. Use a separate work address for staff.');

  const password = newTemporaryPassword();
  const hash = await hashPassword(password);
  const userId = randomUUID();
  const [first, ...rest] = name.split(/\s+/);
  const role = userRole(input.role);
  await db.withUser({ userId, role }, async (tx) => {
    await tx
      .insertInto('users')
      .values({ id: userId, identity_sub: `staff|${userId}`, email, email_verified: false, first_name: (first ?? '').slice(0, 100), last_name: rest.join(' ').slice(0, 100), role, mfa_enforced: true })
      .execute();
    await tx.insertInto('user_settings').values({ user_id: userId }).execute();
    await tx.insertInto('profiles').values({ user_id: userId }).execute();
  });
  const actor: Staff = by ?? { identity: { userId, role }, level: input.role };
  await db.withSystem(`admin ${actor.identity.userId}: create a staff account`, async (tx) => {
    await tx.insertInto('staff_accounts').values({ user_id: userId, email, name, role: input.role, password_hash: hash, must_change_password: true, status: 'invited', invited_by: by?.identity.userId ?? null }).execute();
    await writeAudit(tx, actor, { action: by ? 'staff.invite' : 'staff.bootstrap', targetType: 'user', targetId: userId, after: { email, role: input.role } }, meta);
  });
  return { userId, email, name, password };
}

/** The first Super Admin of an environment, from the command line (`pnpm staff:create`). */
export async function bootstrapStaff(db: Database, input: { name: string; email: string; role: StaffLevel }) {
  const created = await createStaffAccount(db, input, null, {});
  return { email: created.email, temporaryPassword: created.password };
}

export async function inviteStaff(deps: StaffDeps, staff: Staff, input: { name: string; email: string; role: StaffLevel }, meta: RequestMeta) {
  const { userId, email, name, password } = await createStaffAccount(deps.db, input, staff, meta);
  const emailed = await mailTemporaryPassword(deps, email, name, password, 'invite');
  const member: StaffMemberWire = { id: userId, name, email, role: input.role, mfa: 'none', lastActiveAt: null, status: 'invited' };
  return { member, temporaryPassword: password, emailed };
}

/** A new temporary password and no authenticator: the member sets both up again at sign-in. */
export async function resetStaff(deps: StaffDeps, staff: Staff, userId: string, meta: RequestMeta) {
  if (userId === staff.identity.userId) throw errors.conflict('Reset your own sign-in from Settings › Security instead.');
  const password = newTemporaryPassword();
  const hash = await hashPassword(password);
  const account = await deps.db.withSystem(`admin ${staff.identity.userId}: reset a staff sign-in`, async (tx) => {
    const row = await tx.selectFrom('staff_accounts').select(['id', 'email', 'name']).where('user_id', '=', userId).executeTakeFirst();
    if (!row) throw errors.notFound('staff account');
    await tx
      .updateTable('staff_accounts')
      .set({ password_hash: hash, must_change_password: true, totp_sealed: null, totp_added_at: null, totp_last_step: null, totp_last_used_at: null, failed_attempts: 0, locked_until: null, updated_at: sql`now()` })
      .where('id', '=', row.id)
      .execute();
    await tx.deleteFrom('staff_backup_codes').where('staff_id', '=', row.id).execute();
    await writeAudit(tx, staff, { action: 'staff.reset', targetType: 'user', targetId: userId, after: { password: 'temporary', authenticator: 'removed' } }, meta);
    return row;
  });
  await deps.sessions?.destroyAllForUser(userId);
  const emailed = await mailTemporaryPassword(deps, account.email, account.name, password, 'reset');
  return { temporaryPassword: password, emailed };
}

/** Role assignment (§7.17: Super Admin only, audited). Ends the member's sessions so it applies now. */
export async function setStaffRole(deps: StaffDeps, staff: Staff, userId: string, level: StaffLevel, meta: RequestMeta) {
  if (userId === staff.identity.userId) throw errors.conflict('You cannot change your own roles.');
  await deps.db.withSystem(`admin ${staff.identity.userId}: assign a staff role`, async (tx) => {
    const row = await tx.selectFrom('staff_accounts').select(['id', 'role']).where('user_id', '=', userId).executeTakeFirst();
    if (!row) throw errors.notFound('staff account');
    if (row.role === 'super_admin' && level !== 'super_admin') {
      const others = await tx.selectFrom('staff_accounts').select(sql<number>`count(*)::int`.as('n')).where('role', '=', 'super_admin').where('status', '!=', 'disabled').executeTakeFirstOrThrow();
      if (others.n <= 1) throw errors.conflict('Keep at least one Super Admin.');
    }
    await tx.updateTable('staff_accounts').set({ role: level, updated_at: sql`now()` }).where('id', '=', row.id).execute();
    await tx.updateTable('users').set({ role: userRole(level) }).where('id', '=', userId).execute();
    await writeAudit(tx, staff, { action: 'staff.roles', targetType: 'user', targetId: userId, before: { role: row.role }, after: { role: level } }, meta);
  });
  await deps.sessions?.destroyAllForUser(userId);
  return { groups: level === 'super_admin' ? ['admin', 'super_admin'] : [level], role: level };
}

/** Staff names by user id, for the audit log and the activity feed. */
export async function staffNames(db: Database, staff: Staff): Promise<Record<string, string>> {
  const rows = await db.withSystem(`admin ${staff.identity.userId}: staff names`, (tx) => tx.selectFrom('staff_accounts').select(['user_id', 'name']).execute());
  return Object.fromEntries(rows.map((row) => [row.user_id, row.name]));
}
