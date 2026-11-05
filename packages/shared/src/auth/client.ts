import { mobileSessionSchema, sessionSchema, type SessionUser } from '../schemas/auth';
import { createHttpClient, type HttpClient, type HttpClientOptions } from '../repos/http/client';

/**
 * The phone-safe auth client (ImBackendImplementationPlan P4-10). Web and mobile both sign in
 * through it. It rides on the HTTP client core (P5-01), which owns the transport, the bearer
 * refresh and the error mapping; pass the same `http` the repositories use so they share one
 * token store and one refresh.
 */

export type AuthClientOptions = HttpClientOptions | { http: HttpClient };

export function createAuthClient(options: AuthClientOptions) {
  const http = 'http' in options ? options.http : createHttpClient(options);
  const mobile = http.client === 'mobile';

  /** Auth endpoints: a 401 is a wrong password, so never refresh-and-retry or sign out. */
  const authCall = (path: string, body?: unknown) =>
    http.request(path, { method: 'POST', body, authenticated: false });

  async function signedIn(raw: unknown): Promise<SessionUser> {
    if (!mobile) return sessionSchema.parse(raw).user;
    const { user, tokens } = mobileSessionSchema.parse(raw);
    await http.tokens!.set(tokens);
    return user;
  }

  const clearTokens = async () => {
    if (mobile) await http.tokens!.set(null);
  };

  return {
    http,
    request: http.request,
    signUp: (email: string, password: string, name?: string) =>
      authCall('/auth/signup', { email, password, name }).then(() => undefined),
    confirm: (email: string, code: string) =>
      authCall('/auth/confirm', { email, code }).then(() => undefined),
    resendCode: (email: string) => authCall('/auth/resend', { email }).then(() => undefined),
    login: async (email: string, password: string) =>
      signedIn(await authCall('/auth/login', { email, password, client: http.client })),
    /** Web, after Clerk signs the browser in: its session token becomes our session cookie (§169). */
    clerkExchange: async (token: string) =>
      signedIn(await authCall('/auth/clerk/exchange', { token })),
    /** Mobile, after the federated redirect brings the app back with `?code=`. */
    exchange: async (code: string) => signedIn(await authCall('/auth/token/exchange', { code })),
    /** Where to send the browser (web) or the in-app browser session (mobile) to sign in with a provider. */
    federatedUrl: (provider: 'google' | 'apple', redirect?: string) =>
      http.url(`/auth/login/${provider}`, { client: http.client, redirect }),
    session: async () => sessionSchema.parse(await http.request('/auth/session')).user,
    /** Whether a session is live, without signing out on a 401. */
    hasSession: async () => {
      if (mobile && !(await http.tokens!.get())) return false;
      return http
        .request('/auth/session')
        .then(() => true)
        .catch(() => false);
    },
    logout: async () => {
      // Best effort on the server; the local sign-out happens regardless.
      await http.request('/auth/logout', { method: 'POST', authenticated: false }).catch(() => {});
      await clearTokens();
    },
    logoutAll: async () => {
      await http.request('/auth/logout-all', { method: 'POST' });
      await clearTokens();
    },
    forgotPassword: (email: string) =>
      authCall('/auth/password/forgot', { email }).then(() => undefined),
    resetPassword: (email: string, code: string, password: string) =>
      authCall('/auth/password/reset', { email, code, password }).then(() => undefined),
    changePassword: (current: string, next: string) =>
      http.request('/auth/password/change', { body: { current, next } }).then(() => undefined),
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;
