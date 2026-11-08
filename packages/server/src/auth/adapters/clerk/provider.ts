import { createClerkClient, verifyToken } from '@clerk/backend';
import { AuthError, type AuthResult, type FederatedProvider, type IdentityProfile, type IdentityProvider, type VerifiedAccessToken } from '../../ports/identity';

/**
 * Clerk behind the IdentityProvider port (owner, 2026-11-04, toreview §169): Clerk's hosted
 * components do sign-up, email codes, passwords and social sign-in in the browser, so the methods
 * that carry those flows here are refused. The server's part is the exchange: a verified Clerk
 * session token becomes an AuthResult, and `AuthService.complete()` turns that into the same
 * server session (cookie, RLS identity, sessions list) every other sign-in gets. Logout and
 * deletion reach back into Clerk so a revoked server session cannot be re-minted from a live
 * Clerk one.
 *
 * Cognito (§9.4.1, X-07) stays the plan's production target; this adapter is the stand-in for now
 * and is replaced behind the same port.
 */

export interface ClerkUserLike {
  id: string;
  firstName: string | null;
  lastName: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string; verification: { status: string } | null }[];
  externalAccounts: { provider: string; createdAt?: number }[];
}

/** The slice of Clerk this adapter uses, so tests can stand in for it. */
export interface ClerkApi {
  verify(token: string): Promise<{ sub: string; sid?: string; azp?: string }>;
  getUser(userId: string): Promise<ClerkUserLike>;
  /** Whether Clerk still holds the session open; a revoked one's token verifies for up to 60 s. */
  sessionActive(sessionId: string): Promise<boolean>;
  revokeSession(sessionId: string): Promise<void>;
  activeSessionIds(userId: string): Promise<string[]>;
  deleteUser(userId: string): Promise<void>;
}

export interface ClerkIdentityProvider extends IdentityProvider {
  readonly kind: 'clerk';
  /** A Clerk session token (from the browser's `getToken()`) to the profile and session it names. */
  exchange(token: string): Promise<AuthResult>;
}

/** Clerk session tokens live 60 s; the server session is what lasts (sessions.ts). */
const CLERK_TOKEN_SECONDS = 60;

/** A browser token's `azp` must be one of ours; a native app's token has none. */
export function azpAllowed(azp: unknown, authorizedParties: readonly string[]): boolean {
  if (azp === undefined || azp === null || azp === '') return true;
  return typeof azp === 'string' && authorizedParties.includes(azp);
}

export function createClerkApi(options: { secretKey: string; authorizedParties: string[] }): ClerkApi {
  const client = createClerkClient({ secretKey: options.secretKey });
  return {
    async verify(token) {
      // `azp` is checked here, not by verifyToken: given authorizedParties, it refuses a token with
      // no `azp`, and a native app's token carries none (no browser origin to name). A browser's
      // token must still name one of our origins (toreview §173).
      const claims = await verifyToken(token, { secretKey: options.secretKey });
      if (!azpAllowed(claims.azp, options.authorizedParties)) throw new Error('foreign authorized party');
      return { sub: claims.sub, ...(typeof claims.sid === 'string' ? { sid: claims.sid } : {}) };
    },
    getUser: (userId) => client.users.getUser(userId),
    async sessionActive(sessionId) {
      return (await client.sessions.getSession(sessionId)).status === 'active';
    },
    async revokeSession(sessionId) {
      await client.sessions.revokeSession(sessionId);
    },
    async activeSessionIds(userId) {
      const list = await client.sessions.getSessionList({ userId, status: 'active' });
      return list.data.map((session) => session.id);
    },
    async deleteUser(userId) {
      await client.users.deleteUser(userId);
    },
  };
}

export function profileFromClerk(user: ClerkUserLike): IdentityProfile {
  const primary = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
  if (!primary) throw new AuthError('federation_failed', 'the Clerk account has no email address');
  const name = [user.firstName, user.lastName].filter((part) => part && part.trim()).join(' ');
  return {
    sub: user.id,
    pool: 'users',
    email: primary.emailAddress,
    emailVerified: primary.verification?.status === 'verified',
    name: name || null,
    groups: [],
  };
}

const FEDERATED: Record<string, FederatedProvider> = { oauth_google: 'google', google: 'google', oauth_apple: 'apple', apple: 'apple' };

function handledByClerk(): never {
  throw new AuthError('federation_failed', 'handled by Clerk');
}

export function createClerkIdentityProvider(api: ClerkApi): ClerkIdentityProvider {
  async function verified(token: string): Promise<{ sub: string; sid: string }> {
    const claims = await api.verify(token).catch(() => {
      throw new AuthError('token_invalid');
    });
    if (!claims.sid) throw new AuthError('token_invalid', 'not a session token');
    return { sub: claims.sub, sid: claims.sid };
  }

  return {
    kind: 'clerk',

    async exchange(token) {
      const { sub, sid } = await verified(token);
      // A token outlives a sign-out by up to a minute; the exchange must not revive that session.
      if (!(await api.sessionActive(sid).catch(() => false))) throw new AuthError('token_invalid', 'session ended');
      const profile = profileFromClerk(await api.getUser(sub));
      // The server never holds Clerk's tokens: the browser keeps its Clerk session, the server its own.
      return { profile, tokens: { accessToken: '', refreshToken: '', expiresIn: CLERK_TOKEN_SECONDS, sessionRef: sid } };
    },

    async verifyAccessToken(token): Promise<VerifiedAccessToken> {
      const { sub, sid } = await verified(token);
      return { sub, pool: 'users', sessionRef: sid, groups: [], clientId: 'clerk' };
    },

    async revokeSession(sessionRef) {
      // Already ended in Clerk (signed out there first) is the outcome we want.
      await api.revokeSession(sessionRef).catch(() => {});
    },

    async globalSignOut(sub) {
      for (const id of await api.activeSessionIds(sub)) await api.revokeSession(id).catch(() => {});
    },

    async deleteAccount(sub) {
      await api.deleteUser(sub).catch((error: { status?: number }) => {
        if (error?.status !== 404) throw error; // idempotent: already gone
      });
    },

    async listIdentities(sub) {
      const user = await api.getUser(sub);
      return user.externalAccounts.flatMap((account) => {
        const provider = FEDERATED[account.provider];
        return provider ? [{ provider, linkedAt: new Date(account.createdAt ?? 0).toISOString() }] : [];
      });
    },

    // Clerk's components own these flows in the browser.
    signUp: async () => handledByClerk(),
    confirmSignUp: async () => handledByClerk(),
    resendCode: async () => handledByClerk(),
    signIn: async () => handledByClerk(),
    federatedAuthorizeUrl: () => handledByClerk(),
    completeFederated: async () => handledByClerk(),
    refresh: async () => handledByClerk(),
    changePassword: async () => handledByClerk(),
    forgotPassword: async () => handledByClerk(),
    confirmForgotPassword: async () => handledByClerk(),
    requestEmailChange: async () => handledByClerk(),
    confirmEmailChange: async () => handledByClerk(),
    linkFederated: async () => handledByClerk(),
    unlinkIdentity: async () => handledByClerk(),
    // No staff pool on Clerk yet (toreview §169): staff roles stay with the local IdP and Cognito.
    setGroups: async () => handledByClerk(),
  };
}
