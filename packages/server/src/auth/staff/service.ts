import { createHash } from 'node:crypto';
import type Valkey from 'iovalkey';
import type { Selectable } from 'kysely';
import { sql } from 'kysely';

import type { SessionUser } from '@nextkin/shared/schemas/auth';

import type { Database, Tx } from '../../db/database';
import type { StaffAccounts } from '../../db/types.generated';
import { AppError, errors } from '../../http/errors';
import { randomToken } from '../oidc';
import { hashPassword, passwordProblem, verifyAgainstDummy, verifyPassword } from '../password';
import { AuthError } from '../ports/identity';
import type { AuthService } from '../service';
import { newSessionId, sessionCookie, type SessionMeta, type SessionStore } from '../sessions';
import { newTotpSecret, otpauthUrl } from '../totp';
import { BACKUP_CODE, backupCodeHash, newBackupCodes, openSecret, sealSecret, totpStep } from './crypto';
import { networkAllows, type AllowedNetwork } from './networks';

/**
 * Staff sign-in (toreview §171.13; spec §9.4.1: admin MFA required). Staff accounts are the
 * server's own (`app.staff_accounts`), never the users' identity provider, so the portal signs in
 * the same way under Clerk, the local stand-in or Cognito (owner, 2026-11-05).
 *
 * The steps, each answered with what comes next:
 *   1. email + password (+ the authenticator's code once one is set up)
 *   2. a first sign-in sets up the authenticator: scan, then confirm one code; backup codes follow
 *   3. a temporary password (new or reset account) must be replaced before any session exists
 *   4. a server session, as for users, marked as a staff session (idle limit, 12-hour lifetime)
 * Steps 2 and 3 carry a one-time challenge (10 minutes, five tries) that proves the earlier steps.
 * Every refusal reads the same ("email, password or code is wrong"); five in a row lock the account
 * for 15 minutes.
 */

export type StaffAccount = Selectable<StaffAccounts>;

export type StaffStep =
  | { status: 'mfa_required' }
  | { status: 'enroll_totp'; challenge: string; secret: string; otpauthUrl: string }
  | { status: 'change_password'; challenge: string; backupCodes?: string[] }
  | { status: 'signed_in'; user: SessionUser; cookie: string; backupCodes?: string[] };

export type StaffMeta = SessionMeta & { ip?: string; requestId?: string; userAgent?: string };

export interface StaffAuth {
  signIn(input: { email: string; password: string; code?: string }, meta: StaffMeta): Promise<StaffStep>;
  confirmEnrollment(input: { challenge: string; code: string }, meta: StaffMeta): Promise<StaffStep>;
  setPassword(input: { challenge: string; password: string }, meta: StaffMeta): Promise<StaffStep>;
  /** Proves the authenticator again on a live session (sensitive actions, Settings › Security). */
  reauthenticate(sessionId: string, staffId: string, code: string): Promise<void>;
  /** Starts replacing a signed-in member's authenticator: a new secret to scan, unconfirmed. */
  beginReplacement(staffId: string): Promise<{ challenge: string; secret: string; otpauthUrl: string }>;
  confirmReplacement(staffId: string, challenge: string, code: string): Promise<{ backupCodes: string[] }>;
  regenerateBackupCodes(tx: Tx, staffId: string): Promise<string[]>;
}

export interface StaffAuthDeps {
  db: Database;
  valkey: Valkey;
  sessions: SessionStore;
  auth: Pick<AuthService, 'userFor' | 'securityEvent'>;
  /** STAFF_TOTP_KEY. */
  key: string;
  now?: () => number;
}

export const STAFF_SESSION_HOURS = 12;
export const STAFF_PASSWORD_MIN = 12;
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
const CHALLENGE_SECONDS = 600;
const CHALLENGE_TRIES = 5;

interface Challenge {
  staffId: string;
  stage: 'enroll' | 'password' | 'replace';
  /** The authenticator secret being set up, sealed. */
  pending?: string;
  /** Backup codes issued with this enrolment, shown once more if the password step follows. */
  backupCodes?: string[];
  tries: number;
}

const challengeKey = (token: string) => `staff-challenge:${createHash('sha256').update(token).digest('hex')}`;

/** The portal's access policy, one row (`app.admin_settings`). */
export async function readAdminPolicy(db: Database) {
  const row = await db.withSystem('staff: read the admin access policy', (tx) => tx.selectFrom('admin_settings').selectAll().executeTakeFirst());
  return {
    sessionTimeoutMinutes: row?.session_timeout_minutes ?? 30,
    reauthForSensitive: row?.reauth_for_sensitive ?? true,
    allowedNetworks: (Array.isArray(row?.allowed_networks) ? row!.allowed_networks : []) as unknown as AllowedNetwork[],
  };
}

/** The message a refused new password gets, per field. */
export function staffPasswordProblem(password: string, email: string): string | null {
  if (password.length < STAFF_PASSWORD_MIN) return `Use at least ${STAFF_PASSWORD_MIN} characters.`;
  const problem = passwordProblem(password, email);
  if (problem === 'too_long') return 'Use 128 characters or fewer.';
  if (problem === 'too_common') return 'That password is too common. Choose another.';
  if (problem === 'contains_email') return 'Don’t include your email address in the password.';
  return null;
}

export function createStaffAuth(deps: StaffAuthDeps): StaffAuth {
  const { db, valkey, sessions, key } = deps;
  const now = () => deps.now?.() ?? Date.now();

  const findByEmail = (email: string) =>
    db.withSystem('staff sign-in: find the account', (tx) => tx.selectFrom('staff_accounts').selectAll().where('email', '=', email.trim().toLowerCase()).executeTakeFirst());
  const findById = (id: string) => db.withSystem('staff sign-in: load the account', (tx) => tx.selectFrom('staff_accounts').selectAll().where('id', '=', id).executeTakeFirst());

  async function refuse(account: StaffAccount | undefined, meta: StaffMeta): Promise<never> {
    if (account) {
      await db.withSystem('staff sign-in: count a failed attempt', (tx) =>
        tx
          .updateTable('staff_accounts')
          .set({
            failed_attempts: sql`failed_attempts + 1`,
            locked_until: sql`case when failed_attempts + 1 >= ${LOCK_AFTER} then now() + make_interval(mins => ${LOCK_MINUTES}) else locked_until end`,
          })
          .where('id', '=', account.id)
          .execute(),
      );
      await deps.auth.securityEvent(account.user_id, 'staff_sign_in_failed', meta);
    }
    throw new AuthError('invalid_credentials');
  }

  async function newChallenge(challenge: Omit<Challenge, 'tries'>): Promise<string> {
    const token = randomToken(32);
    await valkey.set(challengeKey(token), JSON.stringify({ ...challenge, tries: 0 }), 'EX', CHALLENGE_SECONDS);
    return token;
  }

  async function takeChallenge(token: string, stage: Challenge['stage']): Promise<Challenge> {
    const raw = await valkey.get(challengeKey(token));
    const challenge = raw ? (JSON.parse(raw) as Challenge) : null;
    if (!challenge || challenge.stage !== stage) throw errors.validation({ challenge: 'expired' }, 'This step has expired. Start again.');
    return challenge;
  }

  /** A wrong code inside a challenge: five tries, then the challenge is gone. */
  async function missChallenge(token: string, challenge: Challenge): Promise<never> {
    if (challenge.tries + 1 >= CHALLENGE_TRIES) await valkey.del(challengeKey(token));
    else await valkey.set(challengeKey(token), JSON.stringify({ ...challenge, tries: challenge.tries + 1 }), 'KEEPTTL');
    throw errors.validation({ code: 'invalid' }, 'That code didn’t work. Check your app and try again.');
  }

  /** The authenticator's code or an unused backup code; records what was used. */
  async function codeMatches(account: StaffAccount, code: string): Promise<boolean> {
    const trimmed = code.trim().toLowerCase();
    if (BACKUP_CODE.test(trimmed)) {
      const used = await db.withSystem('staff sign-in: use a backup code', (tx) =>
        tx
          .updateTable('staff_backup_codes')
          .set({ used_at: sql`now()` })
          .where('staff_id', '=', account.id)
          .where('code_hash', '=', backupCodeHash(key, trimmed))
          .where('used_at', 'is', null)
          .executeTakeFirst(),
      );
      return Number(used.numUpdatedRows) === 1;
    }
    const secret = account.totp_sealed ? openSecret(key, account.totp_sealed) : null;
    if (!secret) return false;
    const step = totpStep(secret, trimmed, now());
    if (step === null) return false;
    // A code works once: the step must be newer than the last one accepted.
    const claimed = await db.withSystem('staff sign-in: record the authenticator step', (tx) =>
      tx
        .updateTable('staff_accounts')
        .set({ totp_last_step: String(step), totp_last_used_at: sql`now()` })
        .where('id', '=', account.id)
        .where((eb) => eb.or([eb('totp_last_step', 'is', null), eb('totp_last_step', '<', String(step))]))
        .executeTakeFirst(),
    );
    return Number(claimed.numUpdatedRows) === 1;
  }

  async function issueBackupCodes(tx: Tx, staffId: string): Promise<string[]> {
    const codes = newBackupCodes();
    await tx.deleteFrom('staff_backup_codes').where('staff_id', '=', staffId).execute();
    await tx.insertInto('staff_backup_codes').values(codes.map((code) => ({ staff_id: staffId, code_hash: backupCodeHash(key, code) }))).execute();
    return codes;
  }

  async function startSession(account: StaffAccount, meta: StaffMeta, backupCodes?: string[]): Promise<StaffStep> {
    const policy = await readAdminPolicy(db);
    const role = account.role === 'super_admin' ? 'admin' : (account.role as 'admin' | 'curator' | 'support');
    const user = await db.withSystem('staff sign-in: load the staff user', (tx) => tx.selectFrom('users').select(['id', 'status', 'role']).where('id', '=', account.user_id).executeTakeFirst());
    if (!user || user.status !== 'active') throw new AuthError('invalid_credentials', 'account not active');
    await db.withSystem('staff sign-in: record the sign-in', async (tx) => {
      if (user.role !== role) await tx.updateTable('users').set({ role }).where('id', '=', user.id).execute();
      await tx
        .updateTable('staff_accounts')
        .set({ failed_attempts: 0, locked_until: null, last_sign_in_at: sql`now()`, last_sign_in_ip: meta.ip && meta.ip !== 'unknown' ? meta.ip.slice(0, 64) : null, status: 'active', updated_at: sql`now()` })
        .where('id', '=', account.id)
        .execute();
    });
    const id = newSessionId();
    const lifetime = STAFF_SESSION_HOURS * 3600;
    await sessions.create(
      id,
      {
        userId: user.id,
        role,
        ...(account.role === 'super_admin' ? { superAdmin: true } : {}),
        sub: `staff:${account.id}`,
        pool: 'admins',
        client: 'web',
        sessionRef: `staff:${randomToken(16)}`,
        idleSeconds: policy.sessionTimeoutMinutes * 60,
        lifetimeSeconds: lifetime,
        mfaAt: now(),
      },
      meta,
    );
    await deps.auth.securityEvent(user.id, 'sign_in', meta);
    return { status: 'signed_in', user: await deps.auth.userFor(user.id), cookie: sessionCookie(id, lifetime), ...(backupCodes ? { backupCodes } : {}) };
  }

  async function nextAfterMfa(account: StaffAccount, meta: StaffMeta, backupCodes?: string[]): Promise<StaffStep> {
    if (account.must_change_password) {
      const challenge = await newChallenge({ staffId: account.id, stage: 'password', ...(backupCodes ? { backupCodes } : {}) });
      return { status: 'change_password', challenge, ...(backupCodes ? { backupCodes } : {}) };
    }
    return startSession(account, meta, backupCodes);
  }

  async function assertNetwork(ip: string | undefined) {
    const policy = await readAdminPolicy(db);
    if (!networkAllows(policy.allowedNetworks, ip)) throw new AppError('FORBIDDEN', 'Staff sign-in isn’t allowed from this network.', { network: true });
  }

  return {
    async signIn({ email, password, code }, meta) {
      await assertNetwork(meta.ip);
      const account = await findByEmail(email);
      const locked = account?.locked_until && account.locked_until.getTime() > now();
      if (!account || account.status === 'disabled' || locked) {
        await verifyAgainstDummy(password); // the same cost whatever the reason
        throw new AuthError('invalid_credentials');
      }
      if (!(await verifyPassword(account.password_hash, password))) return refuse(account, meta);

      if (!account.totp_sealed) {
        // First sign-in (or after a reset): set up the authenticator before anything else.
        const secret = newTotpSecret();
        const challenge = await newChallenge({ staffId: account.id, stage: 'enroll', pending: sealSecret(key, secret) });
        return { status: 'enroll_totp', challenge, secret, otpauthUrl: otpauthUrl(secret, account.email) };
      }
      if (!code) return { status: 'mfa_required' };
      if (!(await codeMatches(account, code))) return refuse(account, meta);
      return nextAfterMfa(account, meta);
    },

    async confirmEnrollment({ challenge: token, code }, meta) {
      const challenge = await takeChallenge(token, 'enroll');
      const secret = challenge.pending ? openSecret(key, challenge.pending) : null;
      const step = secret ? totpStep(secret, code.trim(), now()) : null;
      if (!secret || step === null) return missChallenge(token, challenge);
      await valkey.del(challengeKey(token));
      const account = await findById(challenge.staffId);
      if (!account || account.status === 'disabled') throw new AuthError('invalid_credentials');
      const codes = await db.withSystem('staff sign-in: set up the authenticator', async (tx) => {
        await tx
          .updateTable('staff_accounts')
          .set({ totp_sealed: challenge.pending!, totp_added_at: sql`now()`, totp_last_step: String(step), totp_last_used_at: sql`now()`, updated_at: sql`now()` })
          .where('id', '=', account.id)
          .execute();
        return issueBackupCodes(tx, account.id);
      });
      await deps.auth.securityEvent(account.user_id, 'staff_mfa_enrolled', meta);
      return nextAfterMfa(account, meta, codes);
    },

    async setPassword({ challenge: token, password }, meta) {
      const challenge = await takeChallenge(token, 'password');
      const account = await findById(challenge.staffId);
      if (!account || account.status === 'disabled') throw new AuthError('invalid_credentials');
      const problem = staffPasswordProblem(password, account.email);
      if (problem) throw errors.validation({ password: problem }, problem);
      if (await verifyPassword(account.password_hash, password)) {
        throw errors.validation({ password: 'same' }, 'Choose a new password, not the temporary one.');
      }
      await valkey.del(challengeKey(token));
      const hash = await hashPassword(password);
      await db.withSystem('staff sign-in: set a new password', (tx) =>
        tx.updateTable('staff_accounts').set({ password_hash: hash, must_change_password: false, password_changed_at: sql`now()`, updated_at: sql`now()` }).where('id', '=', account.id).execute(),
      );
      await deps.auth.securityEvent(account.user_id, 'password_changed', meta);
      return startSession({ ...account, must_change_password: false }, meta, challenge.backupCodes);
    },

    async reauthenticate(sessionId, staffId, code) {
      const account = await findById(staffId);
      if (!account || !(await codeMatches(account, code))) {
        throw errors.validation({ code: 'invalid' }, 'That code didn’t work. Check your app and try again.');
      }
      await sessions.update(sessionId, { mfaAt: now() });
    },

    async beginReplacement(staffId) {
      const account = await findById(staffId);
      if (!account) throw errors.notFound('staff account');
      const secret = newTotpSecret();
      const challenge = await newChallenge({ staffId, stage: 'replace', pending: sealSecret(key, secret) });
      return { challenge, secret, otpauthUrl: otpauthUrl(secret, account.email) };
    },

    async confirmReplacement(staffId, token, code) {
      const challenge = await takeChallenge(token, 'replace');
      if (challenge.staffId !== staffId) throw errors.forbidden();
      const secret = challenge.pending ? openSecret(key, challenge.pending) : null;
      const step = secret ? totpStep(secret, code.trim(), now()) : null;
      if (!secret || step === null) return missChallenge(token, challenge);
      await valkey.del(challengeKey(token));
      const backupCodes = await db.withSystem('staff: replace the authenticator', async (tx) => {
        await tx
          .updateTable('staff_accounts')
          .set({ totp_sealed: challenge.pending!, totp_added_at: sql`now()`, totp_last_step: String(step), totp_last_used_at: sql`now()`, updated_at: sql`now()` })
          .where('id', '=', staffId)
          .execute();
        return issueBackupCodes(tx, staffId);
      });
      return { backupCodes };
    },

    regenerateBackupCodes: issueBackupCodes,
  };
}
