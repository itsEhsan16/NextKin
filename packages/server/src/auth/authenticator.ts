import type { Authenticator } from '../http/middleware/guards';
import type { IdentityProvider } from './ports/identity';
import { readSessionCookie, type SessionStore } from './sessions';

/**
 * Resolves who a request is (ImBackendImplementationPlan P4-05/P4-06), for P3's authenticate()
 * slot. A web request presents the session cookie; a mobile request presents a bearer token,
 * which must verify against the provider's keys and name a live server session. Either way the
 * session record decides, so logout is immediate for both. Anything invalid is simply anonymous;
 * the route then answers 401.
 */
export function createAuthenticator(idp: IdentityProvider, sessions: SessionStore): Authenticator {
  return async (c) => {
    const authorization = c.req.header('authorization');
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7).trim();
      const verified = await idp.verifyAccessToken(token).catch(() => null);
      if (!verified) return null;
      const session = await sessions.get(verified.sessionRef);
      if (!session || session.sub !== verified.sub) return null;
      return { identity: { userId: session.userId, role: session.role }, via: 'bearer', sessionId: verified.sessionRef, ...(session.superAdmin ? { superAdmin: true } : {}) };
    }
    const id = readSessionCookie(c.req.header('cookie'));
    if (!id) return null;
    const session = await sessions.get(id);
    return session && session.client === 'web' ? { identity: { userId: session.userId, role: session.role }, via: 'cookie', sessionId: id, ...(session.superAdmin ? { superAdmin: true } : {}) } : null;
  };
}
