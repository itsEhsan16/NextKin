import { sql } from 'kysely';

import type { IdentityProvider } from '../../auth/ports/identity';
import type { SessionStore } from '../../auth/sessions';
import type { Database } from '../../db/database';
import { AppError, errors } from '../../http/errors';
import type { Logger } from '../../observability/logger';
import type { PaymentProvider } from '../../payments/types';
import { getSubscription } from '../billing';
import { deleteAccount } from '../privacy';
import { readContent } from '../resumeRead';
import { writeAudit, type RequestMeta } from './audit';
import { dbRole, type Staff } from './permissions';

/**
 * User administration (ImBackendImplementationPlan P12-05; spec §7.17, §8.5). Search and inspect
 * read through the staff role with a recorded reason; every change is audited in its own
 * transaction. Admins never see or set a password: a reset goes through the identity provider. A
 * resume's content is exceptional: it needs a reason, and the read itself is audited.
 */

export const SUSPEND_REASONS = ['abuse', 'fraud', 'chargeback', 'legal', 'user_request', 'other'] as const;
export type SuspendReason = (typeof SUSPEND_REASONS)[number];
export const STAFF_GROUPS = ['support', 'curator', 'admin', 'super_admin'] as const;

export interface AdminUserDeps {
  db: Database;
  log: Logger;
  idp?: IdentityProvider;
  sessions?: SessionStore;
  provider: PaymentProvider;
}


export async function searchUsers(db: Database, staff: Staff, q: string) {
  const term = q.trim();
  if (term.length < 2) throw errors.validation({ q: 'at least 2 characters' }, 'Search for at least two characters.');
  const rows = await db.withStaff({ userId: staff.identity.userId, role: dbRole(staff) }, 'admin: search users', (tx) =>
    tx
      .selectFrom('users')
      .select(['id', 'email', 'first_name', 'last_name', 'status', 'role', 'created_at'])
      .where((eb) => eb.or([eb('email', 'ilike', `%${term.replace(/[%_\\]/g, '\\$&')}%`), eb(sql`first_name || ' ' || last_name`, 'ilike', `%${term.replace(/[%_\\]/g, '\\$&')}%`), ...(/^[0-9a-f-]{36}$/i.test(term) ? [eb('id', '=', term)] : [])]))
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute(),
  );
  return rows.map((r) => ({ id: r.id, email: r.email, name: `${r.first_name} ${r.last_name}`.trim(), status: r.status, role: r.role, createdAt: new Date(r.created_at).toISOString() }));
}

export async function inspectUser(db: Database, staff: Staff, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw errors.notFound('user');
  const detail = await db.withStaff({ userId: staff.identity.userId, role: dbRole(staff) }, 'admin: inspect a user', async (tx) => {
    const user = await tx.selectFrom('users').select(['id', 'email', 'first_name', 'last_name', 'status', 'role', 'email_verified', 'created_at', 'deletion_requested_at']).where('id', '=', userId).executeTakeFirst();
    if (!user) return null;
    const events = await tx.selectFrom('security_events').select(['kind', 'created_at', 'ip']).where('user_id', '=', userId).orderBy('created_at', 'desc').limit(20).execute();
    const counts = await tx.selectFrom('resumes').select(sql<number>`count(*)::int`.as('n')).where('user_id', '=', userId).executeTakeFirstOrThrow();
    return { user, events, resumes: counts.n };
  });
  if (!detail) throw errors.notFound('user');
  // Tier and usage come from the same reader the user sees (their own RLS view).
  const subscription = await getSubscription(db, { userId, role: 'user' });
  return {
    id: detail.user.id,
    email: detail.user.email,
    name: `${detail.user.first_name} ${detail.user.last_name}`.trim(),
    status: detail.user.status,
    role: detail.user.role,
    emailVerified: detail.user.email_verified,
    createdAt: new Date(detail.user.created_at).toISOString(),
    deletionRequestedAt: detail.user.deletion_requested_at ? new Date(detail.user.deletion_requested_at).toISOString() : null,
    resumes: detail.resumes,
    subscription,
    securityEvents: detail.events.map((e) => ({ kind: e.kind, at: new Date(e.created_at).toISOString(), ip: e.ip })),
  };
}

async function endSessions(deps: AdminUserDeps, userId: string): Promise<void> {
  if (!deps.sessions || !deps.idp) return;
  for (const record of await deps.sessions.destroyAllForUser(userId)) await deps.idp.revokeSession(record.sessionRef);
  const sub = await deps.db.withSystem('admin: read a user’s identity', (tx) => tx.selectFrom('users').select('identity_sub').where('id', '=', userId).executeTakeFirst());
  if (sub) await deps.idp.globalSignOut(sub.identity_sub);
}

/** Suspend (sign-in refused, every session ended) or reactivate, with a reason code. */
export async function setUserStatus(deps: AdminUserDeps, staff: Staff, userId: string, status: 'suspended' | 'active', reason: SuspendReason, note: string | undefined, meta: RequestMeta) {
  if (userId === staff.identity.userId) throw errors.conflict('You cannot change your own account’s status.');
  const before = await deps.db.withSystem(`admin ${staff.identity.userId}: ${status === 'suspended' ? 'suspend' : 'reactivate'} a user`, async (tx) => {
    const row = await tx.selectFrom('users').select(['status']).where('id', '=', userId).forUpdate().executeTakeFirst();
    if (!row || row.status === 'deleted') throw errors.notFound('user');
    if (row.status === status) return row.status;
    await tx.updateTable('users').set({ status }).where('id', '=', userId).execute();
    await writeAudit(tx, staff, { action: status === 'suspended' ? 'user.suspend' : 'user.reactivate', targetType: 'user', targetId: userId, before: { status: row.status }, after: { status }, reason: [reason, note].filter(Boolean).join(': ') }, meta);
    return row.status;
  });
  if (status === 'suspended' && before !== 'suspended') await endSessions(deps, userId);
  return { status };
}

/** A reset code goes to the account's own address; the admin never sees or sets a password. */
export async function resetPassword(deps: AdminUserDeps, staff: Staff, userId: string, meta: RequestMeta) {
  if (!deps.idp) throw new AppError('UNAVAILABLE', 'Password resets are not available right now.');
  const user = await deps.db.withSystem(`admin ${staff.identity.userId}: reset a password`, async (tx) => {
    const row = await tx.selectFrom('users').select(['email', 'status']).where('id', '=', userId).executeTakeFirst();
    if (!row || row.status === 'deleted') throw errors.notFound('user');
    await writeAudit(tx, staff, { action: 'user.password_reset', targetType: 'user', targetId: userId }, meta);
    return row;
  });
  await deps.idp.forgotPassword(user.email);
}

/** Processes a deletion request (§8.5) exactly as the user's own deletion would. */
export async function processDeletion(deps: AdminUserDeps, staff: Staff, userId: string, reason: string, meta: RequestMeta) {
  if (!deps.idp || !deps.sessions) throw new AppError('UNAVAILABLE', 'Account deletion is not available right now.');
  await deps.db.withSystem(`admin ${staff.identity.userId}: process a deletion`, async (tx) => {
    const row = await tx.selectFrom('users').select('status').where('id', '=', userId).executeTakeFirst();
    if (!row || row.status === 'deleted') throw errors.notFound('user');
    await writeAudit(tx, staff, { action: 'user.delete', targetType: 'user', targetId: userId, reason }, meta);
  });
  await deleteAccount({ db: deps.db, idp: deps.idp, sessions: deps.sessions, provider: deps.provider, log: deps.log }, { userId, role: 'user' });
}

/** One resume's content: exceptional, with a recorded reason; the read is audited (§7.17). */
export async function readUserResume(db: Database, staff: Staff, userId: string, resumeId: string, reason: string, meta: RequestMeta) {
  if (reason.trim().length < 10) throw errors.validation({ reason: 'at least 10 characters' }, 'Say why you need to read this resume.');
  await db.withSystem(`admin ${staff.identity.userId}: record a content read`, (tx) => writeAudit(tx, staff, { action: 'user.content_read', targetType: 'resume', targetId: resumeId, after: { userId }, reason }, meta));
  try {
    return await db.withStaff({ userId: staff.identity.userId, role: dbRole(staff) }, `admin: read a resume's content (${reason.slice(0, 200)})`, (tx) => readContent(tx, userId, resumeId));
  } catch {
    throw errors.notFound('resume');
  }
}

/** Comped Pro or an extension (§7.17), without the gateway: a subscription with no gateway id. */
export async function grantComp(db: Database, staff: Staff, userId: string, months: number, reason: string, meta: RequestMeta) {
  const until = new Date();
  until.setUTCMonth(until.getUTCMonth() + months);
  await db.withUser({ userId, role: 'user' }, async (tx) => {
    const exists = await tx.selectFrom('users').select('id').where('id', '=', userId).executeTakeFirst();
    if (!exists) throw errors.notFound('user');
    await tx.insertInto('billing_accounts').values({ owner_user_id: userId }).onConflict((oc) => oc.column('owner_user_id').doNothing()).execute();
    const account = await tx.selectFrom('billing_accounts').select('id').where('owner_user_id', '=', userId).executeTakeFirstOrThrow();
    await tx.insertInto('subscriptions').values({ billing_account_id: account.id, user_id: userId, plan_id: 'pro_monthly', status: 'trialing', current_period_end: until }).execute();
  });
  await db.withSystem(`admin ${staff.identity.userId}: record comped access`, (tx) => writeAudit(tx, staff, { action: 'user.comp', targetType: 'user', targetId: userId, after: { plan: 'pro_monthly', until: until.toISOString() }, reason }, meta));
  return { until: until.toISOString() };
}

/** Role assignment (§7.17: Super Admin only, audited). Staff accounts only. */
export async function setRoles(deps: AdminUserDeps, staff: Staff, userId: string, groups: string[], meta: RequestMeta) {
  if (!deps.idp) throw new AppError('UNAVAILABLE', 'Role changes are not available right now.');
  if (userId === staff.identity.userId) throw errors.conflict('You cannot change your own roles.');
  const clean = [...new Set(groups)].filter((g): g is (typeof STAFF_GROUPS)[number] => (STAFF_GROUPS as readonly string[]).includes(g));
  if (clean.length === 0) throw errors.validation({ groups: 'at least one staff role' }, 'Give at least one staff role.');
  const role = clean.includes('admin') || clean.includes('super_admin') ? 'admin' : clean.includes('curator') ? 'curator' : 'support';
  const sub = await deps.db.withSystem(`admin ${staff.identity.userId}: assign roles`, async (tx) => {
    const row = await tx.selectFrom('users').select(['identity_sub', 'role']).where('id', '=', userId).executeTakeFirst();
    if (!row || row.role === 'user') throw errors.notFound('staff account');
    await tx.updateTable('users').set({ role }).where('id', '=', userId).execute();
    await writeAudit(tx, staff, { action: 'staff.roles', targetType: 'user', targetId: userId, before: { role: row.role }, after: { groups: clean } }, meta);
    return row.identity_sub;
  });
  await deps.idp.setGroups(sub, clean);
  await endSessions(deps, userId);
  return { groups: clean };
}

