import { sql } from 'kysely';

import { hashPassword } from '../auth/password';
import type { Database } from '../db/database';
import { stableId } from './ids';
import { SEED_ADMIN_ID } from './reference';

/**
 * The seeded staff accounts (toreview §171.13): admin@ (Super Admin), curator@ and support@
 * nextkin.test, on the role accounts `seedAccounts` creates. Staff sign in with their own account,
 * never the users' identity provider, so this runs under every IDENTITY_ADAPTER.
 *
 * Each starts as a new account would: the seed password as its temporary password and no
 * authenticator, so the first sign-in sets up the authenticator and chooses a new password (owner,
 * 2026-11-05). An account that already exists is left as it is, so reseeding never undoes a
 * password or an authenticator someone has set up.
 */
const STAFF = [
  { key: 'admin', userId: SEED_ADMIN_ID, name: 'Ada Admin', role: 'super_admin' },
  { key: 'curator', userId: stableId('account:curator'), name: 'Cyrus Curator', role: 'curator' },
  { key: 'support', userId: stableId('account:support'), name: 'Sam Support', role: 'support' },
] as const;

export async function seedStaff(db: Database, temporaryPassword: string): Promise<number> {
  const hash = await hashPassword(temporaryPassword);
  let created = 0;
  for (const member of STAFF) {
    const result = await db.withSystem(`seed: staff account ${member.key}`, (tx) =>
      tx
        .insertInto('staff_accounts')
        .values({ user_id: member.userId, email: `${member.key}@nextkin.test`, name: member.name, role: member.role, password_hash: hash, must_change_password: true, status: 'invited', created_at: sql`now()` })
        .onConflict((oc) => oc.doNothing())
        .returning('id')
        .executeTakeFirst(),
    );
    if (result) created++;
  }
  return created;
}
