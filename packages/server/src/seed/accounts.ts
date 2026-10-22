import type { Database } from '../db/database';
import { stableId } from './ids';
import { SEED_ADMIN_ID } from './reference';

/**
 * One account per tier and staff role (ImBackendImplementationPlan P2-08 / M0-26), for sign-in
 * work (P4) and the authorization matrix (P4-05, P12-01). Emails use the reserved `.test` domain.
 * P4's local identity provider gives each a password; nothing here is a credential.
 */
const ACCOUNTS = [
  { key: 'free', role: 'user', plan: 'free', first: 'Fran', last: 'Free' },
  { key: 'pro', role: 'user', plan: 'pro_monthly', first: 'Priya', last: 'Pro' },
  { key: 'admin', role: 'admin', plan: 'free', first: 'Ada', last: 'Admin' },
  { key: 'curator', role: 'curator', plan: 'free', first: 'Cyrus', last: 'Curator' },
  { key: 'support', role: 'support', plan: 'free', first: 'Sam', last: 'Support' },
] as const;

export async function seedAccounts(db: Database): Promise<string[]> {
  const ids: string[] = [];
  for (const account of ACCOUNTS) {
    const userId = account.key === 'admin' ? SEED_ADMIN_ID : stableId(`account:${account.key}`);
    await db.withSystem(`seed: replace account ${account.key}`, (tx) => tx.deleteFrom('users').where('id', '=', userId).execute());
    await db.withUser({ userId, role: account.role }, async (tx) => {
      await tx
        .insertInto('users')
        .values({
          id: userId,
          identity_sub: `local|account:${account.key}`,
          email: `${account.key}@nextkin.test`,
          email_verified: true,
          first_name: account.first,
          last_name: account.last,
          role: account.role,
          mfa_enforced: account.role !== 'user',
        })
        .execute();
      await tx.insertInto('user_settings').values({ user_id: userId }).execute();
      await tx.insertInto('profiles').values({ user_id: userId }).execute();
      const billing = await tx.insertInto('billing_accounts').values({ owner_user_id: userId }).returning('id').executeTakeFirstOrThrow();
      await tx
        .insertInto('subscriptions')
        .values({ billing_account_id: billing.id, user_id: userId, plan_id: account.plan, status: 'active' })
        .execute();
    });
    ids.push(userId);
  }
  return ids;
}
