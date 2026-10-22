import { createHash } from 'node:crypto';
import type pg from 'pg';
import type { EmailPort } from '../../../email/email';
import { authorizeUrl, exchangeCode, randomToken, type OidcIssuer } from '../../oidc';
import { hashPassword, passwordProblem, verifyAgainstDummy, verifyPassword } from '../../password';
import { verifyTotp } from '../../totp';
import { AuthError, type AuthResult, type IdentityProfile, type IdentityProvider, type Pool, type TokenSet } from '../../ports/identity';
import { createAccountChanges } from './accountChanges';
import { consumeCode, issueCode } from './codes';
import { ACCESS_TOKEN_SECONDS, createLocalKeys, type LocalKeys } from './keys';

/**
 * The local identity provider (ImBackendImplementationPlan P4-02/P4-03): a Cognito stand-in for
 * local development and tests. Refused in staging and production by config (L3). It reproduces
 * the behaviours the product depends on — not Cognito's internals — and the identity contract suite
 * proves each one, so the Cognito adapter (X-07) can be held to the same suite.
 */

const REFRESH_DAYS = 30; // spec §9.4.1: 30-day refresh token = absolute session lifetime
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const normalise = (email: string) => email.trim().toLowerCase();

export interface AccountRow {
  sub: string;
  pool: Pool;
  email: string;
  email_verified: boolean;
  password_hash: string | null;
  name: string | null;
  groups: string[];
  totp_secret: string | null;
  failed_attempts: number;
  locked_until: Date | null;
}

const toProfile = (a: AccountRow): IdentityProfile => ({
  sub: a.sub,
  pool: a.pool,
  email: a.email,
  emailVerified: a.email_verified,
  name: a.name,
  groups: a.groups,
});

export interface LocalProviderOptions {
  pool: pg.Pool;
  email: EmailPort;
  issuers: Partial<Record<'google' | 'apple', OidcIssuer>>;
}

export type LocalIdentityProvider = IdentityProvider & {
  jwks(): ReturnType<LocalKeys['jwks']>;
  /** Seeding only: creates or replaces an account with a fixed sub. */
  upsertAccount(input: { sub: string; pool: Pool; email: string; password: string; name?: string; groups?: string[]; totpSecret?: string }): Promise<void>;
};

export function createLocalIdentityProvider(options: LocalProviderOptions): LocalIdentityProvider {
  const { pool: db, email: mail } = options;
  const keys = createLocalKeys(db);

  const findAccount = async (pool: Pool, email: string) =>
    (await db.query<AccountRow>('select * from local_idp.accounts where pool = $1 and email = $2', [pool, normalise(email)])).rows[0];

  const accountBySub = async (sub: string) =>
    (await db.query<AccountRow>('select * from local_idp.accounts where sub = $1', [sub])).rows[0];

  async function issueTokens(account: AccountRow, clientId: string, family = randomToken(24)): Promise<TokenSet> {
    const refreshToken = randomToken(48);
    await db.query(
      `insert into local_idp.refresh_tokens (token_hash, family, sub, client_id, expires_at)
       values ($1, $2, $3, $4, coalesce((select min(expires_at) from local_idp.refresh_tokens where family = $2), now() + make_interval(days => $5)))`,
      [hashToken(refreshToken), family, account.sub, clientId, REFRESH_DAYS],
    );
    const accessToken = await keys.sign({
      sub: account.sub,
      aud: clientId,
      token_use: 'access',
      sid: family,
      pool: account.pool,
      'cognito:groups': account.groups,
    });
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_SECONDS, sessionRef: family };
  }

  async function revokeFamilies(where: string, value: string) {
    await db.query(`update local_idp.refresh_tokens set revoked_at = now() where ${where} = $1 and revoked_at is null`, [value]);
  }

  const provider: LocalIdentityProvider = {
    async signUp({ email, password, name }) {
      const address = normalise(email);
      const problem = passwordProblem(password, address);
      if (problem) throw new AuthError('weak_password', problem);
      const existing = await findAccount('users', address);
      if (existing?.password_hash && existing.email_verified) {
        // Same answer as a new sign-up; the owner learns someone tried (no account enumeration).
        await mail.send({ to: address, subject: 'Someone tried to sign up with your email', text: 'An account already exists for this email. Sign in, or reset your password if you forgot it. If this was not you, you can ignore this message.' });
        return;
      }
      const passwordHash = await hashPassword(password);
      if (!existing) {
        await db.query('insert into local_idp.accounts (sub, pool, email, password_hash, name) values ($1, $2, $3, $4, $5)', [
          `local|${randomToken(16)}`,
          'users',
          address,
          passwordHash,
          name ?? null,
        ]);
      } else if (!existing.email_verified) {
        // Never confirmed, so never proven: the new sign-up replaces the old password.
        await db.query('update local_idp.accounts set password_hash = $1, name = coalesce($2, name) where sub = $3', [passwordHash, name ?? null, existing.sub]);
      }
      // A federated-only account gets its password only once the code proves the mailbox (linking,
      // the Google-first-then-password ordering).
      const pending = existing && existing.email_verified && !existing.password_hash ? { passwordHash } : undefined;
      const code = await issueCode(db, { pool: 'users', email: address, purpose: 'confirm_sign_up', pending });
      await mail.send({ to: address, subject: 'Your NextKin verification code', text: `Your verification code is ${code}. It expires in 15 minutes.` });
    },

    async confirmSignUp(email, code) {
      const address = normalise(email);
      const pending = await consumeCode(db, { pool: 'users', email: address, purpose: 'confirm_sign_up', code });
      if (!pending) throw new AuthError('code_invalid');
      await db.query(
        `update local_idp.accounts set email_verified = true, password_hash = coalesce($1, password_hash)
          where pool = 'users' and email = $2`,
        [(pending.passwordHash as string | undefined) ?? null, address],
      );
    },

    async resendCode(email) {
      const account = await findAccount('users', email);
      if (!account || account.email_verified) return; // uniform: nothing to resend
      const code = await issueCode(db, { pool: 'users', email: account.email, purpose: 'confirm_sign_up' });
      await mail.send({ to: account.email, subject: 'Your NextKin verification code', text: `Your verification code is ${code}. It expires in 15 minutes.` });
    },

    async signIn({ email, password, pool, totp, clientId }): Promise<AuthResult> {
      const account = await findAccount(pool, email);
      const locked = account?.locked_until && account.locked_until > new Date();
      if (!account || !account.password_hash || locked) {
        await verifyAgainstDummy(password); // same cost whatever the reason (timing)
        throw new AuthError('invalid_credentials');
      }
      if (!(await verifyPassword(account.password_hash, password))) {
        await db.query(
          `update local_idp.accounts set failed_attempts = failed_attempts + 1,
             locked_until = case when failed_attempts + 1 >= $2 then now() + make_interval(mins => $3) else locked_until end
           where sub = $1`,
          [account.sub, LOCK_AFTER, LOCK_MINUTES],
        );
        throw new AuthError('invalid_credentials');
      }
      if (!account.email_verified) throw new AuthError('not_confirmed');
      if (pool === 'admins') {
        if (!totp) throw new AuthError('mfa_required');
        if (!account.totp_secret || !verifyTotp(account.totp_secret, totp)) throw new AuthError('invalid_credentials');
      }
      await db.query('update local_idp.accounts set failed_attempts = 0, locked_until = null where sub = $1', [account.sub]);
      return { profile: toProfile(account), tokens: await issueTokens(account, clientId) };
    },

    federatedAuthorizeUrl(providerName, start) {
      const issuer = options.issuers[providerName];
      if (!issuer) throw new AuthError('federation_failed', `${providerName} is not configured`);
      return authorizeUrl(issuer, start);
    },

    async completeFederated(providerName, input, clientId) {
      const issuer = options.issuers[providerName];
      if (!issuer) throw new AuthError('federation_failed', `${providerName} is not configured`);
      const claims = await exchangeCode(issuer, input).catch(() => {
        throw new AuthError('federation_failed');
      });
      const email = typeof claims.email === 'string' ? normalise(claims.email) : null;
      const verified = claims.email_verified === true || claims.email_verified === 'true';
      const appleName = [input.appleUser?.name?.firstName, input.appleUser?.name?.lastName].filter(Boolean).join(' ') || null;
      const name = (typeof claims.name === 'string' ? claims.name : null) ?? appleName;

      const linked = await db.query<{ sub: string }>('select sub from local_idp.identities where provider = $1 and provider_sub = $2', [providerName, claims.sub]);
      let account: AccountRow | undefined;
      let didLink = false;
      if (linked.rows[0]) {
        account = (await db.query<AccountRow>('select * from local_idp.accounts where sub = $1', [linked.rows[0].sub])).rows[0];
      } else {
        if (!email) throw new AuthError('federation_failed', 'the provider returned no email');
        account = await findAccount('users', email);
        if (account) {
          // Link only on a provider-verified email to an account whose email is proven too.
          if (!verified || !account.email_verified) throw new AuthError('federation_failed', 'sign in with your password, then link this provider');
          didLink = true;
        } else {
          const sub = `local|${randomToken(16)}`;
          await db.query('insert into local_idp.accounts (sub, pool, email, email_verified, name) values ($1, $2, $3, $4, $5)', [sub, 'users', email, verified, name]);
          account = (await db.query<AccountRow>('select * from local_idp.accounts where sub = $1', [sub])).rows[0];
        }
        await db.query('insert into local_idp.identities (provider, provider_sub, sub) values ($1, $2, $3)', [providerName, claims.sub, account!.sub]);
      }
      if (!account) throw new AuthError('federation_failed');
      // Apple sends the name once, on the first authorization: keep it if we have none.
      if (name && !account.name) {
        await db.query('update local_idp.accounts set name = $1 where sub = $2', [name, account.sub]);
        account = { ...account, name };
      }
      return { profile: toProfile(account), tokens: await issueTokens(account, clientId), linked: didLink };
    },

    async refresh(refreshToken) {
      const { rows } = await db.query<{ token_hash: string; family: string; sub: string; client_id: string; expires_at: Date; rotated_at: Date | null; revoked_at: Date | null }>(
        'select * from local_idp.refresh_tokens where token_hash = $1',
        [hashToken(refreshToken)],
      );
      const row = rows[0];
      if (!row || row.revoked_at || row.expires_at < new Date()) throw new AuthError('token_invalid');
      if (row.rotated_at) {
        // A rotated token came back: someone holds a stolen copy. End the whole session.
        await revokeFamilies('family', row.family);
        throw new AuthError('token_reused', undefined, row.family);
      }
      const rotated = await db.query('update local_idp.refresh_tokens set rotated_at = now() where token_hash = $1 and rotated_at is null', [row.token_hash]);
      if (rotated.rowCount !== 1) {
        await revokeFamilies('family', row.family);
        throw new AuthError('token_reused', undefined, row.family);
      }
      const account = (await db.query<AccountRow>('select * from local_idp.accounts where sub = $1', [row.sub])).rows[0];
      if (!account) throw new AuthError('token_invalid');
      return issueTokens(account, row.client_id, row.family);
    },

    async verifyAccessToken(token) {
      const payload = await keys.verify(token).catch(() => {
        throw new AuthError('token_invalid');
      });
      if (payload.token_use !== 'access' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || typeof payload.aud !== 'string') {
        throw new AuthError('token_invalid');
      }
      return {
        sub: payload.sub,
        pool: payload.pool === 'admins' ? 'admins' : 'users',
        sessionRef: payload.sid,
        groups: Array.isArray(payload['cognito:groups']) ? (payload['cognito:groups'] as string[]) : [],
        clientId: payload.aud,
      };
    },

    async setGroups(sub, groups) {
      await db.query("update local_idp.accounts set groups = $1 where sub = $2 and pool = 'admins'", [groups, sub]);
      await revokeFamilies('sub', sub); // a role change ends the account's sessions; the next sign-in carries the new groups
    },

    async deleteAccount(sub) {
      // Identities, refresh tokens and codes go with it (ON DELETE CASCADE, or keyed by email).
      const gone = await db.query<{ email: string; pool: string }>('delete from local_idp.accounts where sub = $1 returning email, pool', [sub]);
      for (const row of gone.rows) await db.query('delete from local_idp.codes where pool = $1 and email = $2', [row.pool, row.email]);
    },

    revokeSession: (sessionRef) => revokeFamilies('family', sessionRef),
    globalSignOut: (sub) => revokeFamilies('sub', sub),

    async changePassword(sub, current, next) {
      const account = (await db.query<AccountRow>('select * from local_idp.accounts where sub = $1', [sub])).rows[0];
      if (!account || !(await verifyPassword(account.password_hash, current))) throw new AuthError('invalid_credentials');
      const problem = passwordProblem(next, account.email);
      if (problem) throw new AuthError('weak_password', problem);
      await db.query('update local_idp.accounts set password_hash = $1 where sub = $2', [await hashPassword(next), sub]);
      await revokeFamilies('sub', sub); // a password change ends every session (spec §7.1)
    },

    async forgotPassword(email) {
      const account = await findAccount('users', email);
      if (!account) return; // uniform answer
      const code = await issueCode(db, { pool: 'users', email: account.email, purpose: 'reset_password' });
      await mail.send({ to: account.email, subject: 'Reset your NextKin password', text: `Your password reset code is ${code}. It expires in 15 minutes. If you did not ask for this, ignore this message.` });
    },

    async confirmForgotPassword(email, code, password) {
      const address = normalise(email);
      const problem = passwordProblem(password, address);
      if (problem) throw new AuthError('weak_password', problem);
      const pending = await consumeCode(db, { pool: 'users', email: address, purpose: 'reset_password', code });
      if (!pending) throw new AuthError('code_invalid');
      const { rows } = await db.query<{ sub: string }>(
        `update local_idp.accounts set password_hash = $1, email_verified = true, failed_attempts = 0, locked_until = null
          where pool = 'users' and email = $2 returning sub`,
        [await hashPassword(password), address],
      );
      if (rows[0]) await revokeFamilies('sub', rows[0].sub);
    },

    ...createAccountChanges({ db, mail, issuers: options.issuers, findAccount, accountBySub }),

    jwks: () => keys.jwks(),

    async upsertAccount(input) {
      await db.query(
        `insert into local_idp.accounts (sub, pool, email, email_verified, password_hash, name, groups, totp_secret)
         values ($1, $2, $3, true, $4, $5, $6, $7)
         on conflict (sub) do update set pool = excluded.pool, email = excluded.email, email_verified = true,
           password_hash = excluded.password_hash, name = excluded.name, groups = excluded.groups,
           totp_secret = excluded.totp_secret, failed_attempts = 0, locked_until = null`,
        [input.sub, input.pool, normalise(input.email), await hashPassword(input.password), input.name ?? null, input.groups ?? [], input.totpSecret ?? null],
      );
    },
  };
  return provider;
}
