import type Valkey from 'iovalkey';
import type { SessionUser, TokenSetWire } from '@nextkin/shared/schemas/auth';
import type { Database } from '../db/database';
import { AppError, errors } from '../http/errors';
import { AuthError, type AuthResult, type ClientKind, type IdentityProvider } from './ports/identity';
import { newSessionId, sessionCookie, type SessionMeta, type SessionStore } from './sessions';
import { resolveUser } from './users';
import { randomToken } from './oidc';

/**
 * Turns a successful sign-in (password or federated) into a server session — the one place both
 * paths and both clients meet (ImBackendImplementationPlan P4-04/P4-05). It also records the
 * security event the user sees on their account (spec §7.1: auth events are audited).
 */

export interface SignedIn {
  user: SessionUser;
  /** Web: the Set-Cookie value. */
  cookie?: string;
  /** Mobile: the tokens to hand to the app. */
  tokens?: TokenSetWire;
}

export interface AuthService {
  complete(result: AuthResult, client: ClientKind, meta: SessionMeta & { ip?: string; requestId?: string }): Promise<SignedIn>;
  userFor(userId: string): Promise<SessionUser>;
  /** Mobile federated sign-in: park the tokens behind a one-time code for 60 s (C-12 handoff). */
  parkHandoff(value: SignedIn): Promise<string>;
  takeHandoff(code: string): Promise<SignedIn | null>;
  securityEvent(userId: string, kind: string, meta: { ip?: string; requestId?: string; userAgent?: string }): Promise<void>;
}

export function createAuthService(deps: { db: Database; idp: IdentityProvider; sessions: SessionStore; valkey: Valkey }): AuthService {
  const { db, sessions, valkey } = deps;

  async function userFor(userId: string): Promise<SessionUser> {
    const row = await db.withUser({ userId, role: 'user' }, (tx) =>
      tx.selectFrom('users').select(['id', 'email', 'first_name', 'last_name', 'email_verified', 'role']).where('id', '=', userId).executeTakeFirstOrThrow(),
    );
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      emailVerified: row.email_verified,
      role: row.role as SessionUser['role'],
    };
  }

  async function securityEvent(userId: string, kind: string, meta: { ip?: string; requestId?: string; userAgent?: string }) {
    const ip = meta.ip && meta.ip !== 'unknown' ? meta.ip : null;
    await db
      .withUser({ userId, role: 'user' }, (tx) =>
        tx
          .insertInto('security_events')
          .values({ user_id: userId, kind, ip, request_id: meta.requestId ?? null, user_agent: meta.userAgent?.slice(0, 400) ?? null })
          .execute(),
      )
      .catch(() => {}); // an audit write must never fail the sign-in it describes
  }

  return {
    userFor,
    securityEvent,

    async complete(result, client, meta) {
      const resolved = await resolveUser(db, result.profile);
      if (resolved.status !== 'active') {
        await deps.idp.revokeSession(result.tokens.sessionRef);
        throw new AuthError('invalid_credentials', 'account not active');
      }
      const base = {
        userId: resolved.userId,
        role: resolved.role,
        ...(result.profile.pool === 'admins' && result.profile.groups.includes('super_admin') ? { superAdmin: true } : {}),
        sub: result.profile.sub,
        pool: result.profile.pool,
        client,
        sessionRef: result.tokens.sessionRef,
      };
      // Web gets a fresh random id (never one the client chose: no session fixation). Mobile's
      // session is keyed by the provider's sessionRef, which its access token carries as `sid`.
      const id = client === 'web' ? newSessionId() : result.tokens.sessionRef;
      await sessions.create(id, base, meta);
      await securityEvent(resolved.userId, resolved.created ? 'sign_up' : 'sign_in', meta);
      const user = await userFor(resolved.userId);
      return client === 'web'
        ? { user, cookie: sessionCookie(id) }
        : { user, tokens: { accessToken: result.tokens.accessToken, refreshToken: result.tokens.refreshToken, expiresIn: result.tokens.expiresIn } };
    },

    async parkHandoff(value) {
      const code = randomToken(32);
      await valkey.set(`handoff:${code}`, JSON.stringify(value), 'EX', 60);
      return code;
    },

    async takeHandoff(code) {
      const raw = await valkey.getdel(`handoff:${code}`);
      return raw ? (JSON.parse(raw) as SignedIn) : null;
    },
  };
}

/** Maps provider failures onto the envelope without revealing which part was wrong. */
export function authErrorToApp(error: unknown): never {
  if (!(error instanceof AuthError)) throw error;
  switch (error.failure) {
    case 'weak_password':
      throw errors.validation({ password: error.message }, 'Choose a longer or less common password.');
    case 'code_invalid':
      throw errors.validation({ code: 'invalid' }, 'That code is wrong or has expired.');
    case 'not_confirmed':
      throw new AppError('FORBIDDEN', 'Confirm your email address first: we sent you a code.', { notConfirmed: true });
    case 'mfa_required':
      throw new AppError('UNAUTHENTICATED', 'Enter the code from your authenticator app.', { mfaRequired: true });
    case 'last_sign_in_method':
      throw errors.conflict('Set a password before you unlink your only sign-in method.');
    case 'federation_failed':
      throw errors.validation({ federation: error.message }, 'Sign-in with that provider did not complete.');
    default:
      throw errors.unauthenticated();
  }
}
