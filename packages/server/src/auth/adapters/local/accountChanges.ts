import type pg from 'pg';
import type { EmailPort } from '../../../email/email';
import { exchangeCode, type OidcIssuer } from '../../oidc';
import { AuthError, type IdentityProvider, type Pool } from '../../ports/identity';
import { consumeCode, issueCode } from './codes';
import type { AccountRow } from './provider';

/**
 * The local identity provider's account changes (ImBackendImplementationPlan P5-06): email change
 * behind a code sent to the new address, and linking, listing and unlinking Google and Apple.
 */

const normalise = (email: string) => email.trim().toLowerCase();

interface Deps {
  db: pg.Pool;
  mail: EmailPort;
  issuers: Partial<Record<'google' | 'apple', OidcIssuer>>;
  findAccount(pool: Pool, email: string): Promise<AccountRow | undefined>;
  accountBySub(sub: string): Promise<AccountRow | undefined>;
}

type AccountChanges = Pick<IdentityProvider, 'requestEmailChange' | 'confirmEmailChange' | 'listIdentities' | 'linkFederated' | 'unlinkIdentity'>;

export function createAccountChanges({ db, mail, issuers, findAccount, accountBySub }: Deps): AccountChanges {
  const options = { issuers };
  return {
    async requestEmailChange(sub, newEmail) {
      const account = await accountBySub(sub);
      if (!account) throw new AuthError('invalid_credentials');
      const address = normalise(newEmail);
      if (address === account.email) return;
      if (await findAccount(account.pool, address)) {
        // Same answer either way; the address's owner learns someone tried (no enumeration).
        await mail.send({ to: address, subject: 'Someone tried to use your email on NextKin', text: 'Another account asked to switch to this email address. Nothing has changed. If this was not you, you can ignore this message.' });
        return;
      }
      const code = await issueCode(db, { pool: account.pool, email: account.email, purpose: 'change_email', pending: { newEmail: address } });
      await mail.send({ to: address, subject: 'Confirm your new NextKin email', text: `Your code is ${code}. It expires in 15 minutes. Your email changes only once you enter it.` });
    },

    async confirmEmailChange(sub, code) {
      const account = await accountBySub(sub);
      if (!account) throw new AuthError('invalid_credentials');
      const pending = await consumeCode(db, { pool: account.pool, email: account.email, purpose: 'change_email', code });
      const newEmail = typeof pending?.newEmail === 'string' ? pending.newEmail : null;
      if (!newEmail) throw new AuthError('code_invalid');
      try {
        await db.query('update local_idp.accounts set email = $1, email_verified = true where sub = $2', [newEmail, sub]);
      } catch {
        throw new AuthError('code_invalid', 'that address was taken in the meantime');
      }
      return { email: newEmail };
    },

    async listIdentities(sub) {
      const { rows } = await db.query<{ provider: 'google' | 'apple'; linked_at: Date }>(
        'select provider, linked_at from local_idp.identities where sub = $1 order by linked_at',
        [sub],
      );
      return rows.map((row) => ({ provider: row.provider, linkedAt: row.linked_at.toISOString() }));
    },

    async linkFederated(sub, providerName, input) {
      const issuer = options.issuers[providerName];
      if (!issuer) throw new AuthError('federation_failed', `${providerName} is not configured`);
      const claims = await exchangeCode(issuer, input).catch(() => {
        throw new AuthError('federation_failed');
      });
      const existing = await db.query<{ sub: string }>('select sub from local_idp.identities where provider = $1 and provider_sub = $2', [providerName, claims.sub]);
      if (existing.rows[0]) {
        if (existing.rows[0].sub === sub) return;
        throw new AuthError('federation_failed', 'that account is already linked to a different NextKin account');
      }
      await db.query('insert into local_idp.identities (provider, provider_sub, sub) values ($1, $2, $3)', [providerName, claims.sub, sub]);
    },

    async unlinkIdentity(sub, providerName) {
      const account = await accountBySub(sub);
      if (!account) throw new AuthError('invalid_credentials');
      const { rows } = await db.query<{ provider: string }>('select provider from local_idp.identities where sub = $1', [sub]);
      if (!rows.some((row) => row.provider === providerName)) return;
      if (!account.password_hash && rows.length <= 1) throw new AuthError('last_sign_in_method');
      await db.query('delete from local_idp.identities where sub = $1 and provider = $2', [sub, providerName]);
    },

  };
}
