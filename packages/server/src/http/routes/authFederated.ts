import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type Valkey from 'iovalkey';
import { exchangeSchema, mobileSessionSchema, refreshSchema, tokenSetSchema } from '@nextkin/shared/schemas/auth';
import { pkcePair, randomToken } from '../../auth/oidc';
import { AuthError, type ClientKind, type FederatedProvider, type IdentityProvider } from '../../auth/ports/identity';
import { authErrorToApp, type AuthService } from '../../auth/service';
import type { SessionStore } from '../../auth/sessions';
import type { ApiEnv } from '../env';
import { errors } from '../errors';
import { checked } from '../respond';
import { authErrors, commonErrors } from './common';
import { requireAuth } from '../middleware/guards';
import type { Database } from '../../db/database';
import { requestMeta, subFor } from './auth';

/**
 * Google and Apple sign-in, the mobile hand-off, and token refresh (ImBackendImplementationPlan
 * P4-03, P4-06, P4-07). The browser goes to the provider with PKCE, `state` and `nonce`; the
 * callback finishes the exchange on the server.
 *
 * Mobile (C-12): Expo Go's `exp://` redirect cannot be registered with Cognito, so the server
 * performs the exchange and redirects to an allowlisted app URL carrying a one-time code, valid
 * 60 s, which the app swaps for its tokens at /auth/token/exchange. Tokens never travel in a URL.
 */

export interface FederatedDeps {
  db: Database;
  idp: IdentityProvider;
  auth: AuthService;
  sessions: SessionStore;
  valkey: Valkey;
  appOrigin: string;
  /** Public base URL of this API; the provider redirects back to `${apiPublicUrl}/api/v1/auth/callback`. */
  apiPublicUrl: string;
  /** Prefixes an app redirect must start with (nextkin://, and exp:// locally). */
  mobileRedirectAllowlist: string[];
  jwks?: () => Promise<{ keys: unknown[] }>;
}

interface PendingLogin {
  provider: FederatedProvider;
  client: ClientKind;
  verifier: string;
  nonce: string;
  returnTo: string;
  /** Set when a signed-in user is linking a provider (Settings → Connected accounts), not signing in. */
  link?: { userId: string; sub: string };
}

/** Only same-site paths for web (no open redirects); only allowlisted app URLs for mobile. */
function safeReturnTo(client: ClientKind, value: string | undefined, allowlist: string[]): string {
  if (client === 'web') return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';
  if (value && allowlist.some((prefix) => value.startsWith(prefix))) return value;
  throw errors.validation({ redirect: 'not allowed' }, 'That app redirect is not allowed.');
}

const providerParam = z.object({ provider: z.enum(['google', 'apple']) });

export function federatedRoutes(deps: FederatedDeps): OpenAPIHono<ApiEnv> {
  const app = new OpenAPIHono<ApiEnv>();
  const redirectUri = `${deps.apiPublicUrl.replace(/\/$/, '')}/api/v1/auth/callback`;

  async function start(c: Context<ApiEnv>, provider: FederatedProvider, client: ClientKind, returnTo: string, link?: PendingLogin['link']) {
    const state = randomToken(24);
    const nonce = randomToken(24);
    const { verifier, challenge } = pkcePair();
    const pending: PendingLogin = { provider, client, verifier, nonce, returnTo, link };
    await deps.valkey.set(`oauth:${state}`, JSON.stringify(pending), 'EX', 600);
    const url = (() => {
      try {
        return deps.idp.federatedAuthorizeUrl(provider, { state, nonce, codeChallenge: challenge, redirectUri });
      } catch (error) {
        return authErrorToApp(error);
      }
    })();
    return c.redirect(url, 302);
  }

  app.openapi(
    createRoute({
      method: 'get',
      path: '/auth/login/{provider}',
      tags: ['auth'],
      summary: 'Start Google or Apple sign-in (redirects to the provider).',
      request: { params: providerParam, query: z.object({ client: z.enum(['web', 'mobile']).default('web'), redirect: z.string().max(500).optional() }) },
      responses: { 302: { description: 'To the provider.' }, ...commonErrors },
    }),
    async (c) => {
      const { provider } = c.req.valid('param');
      const { client, redirect } = c.req.valid('query');
      return start(c, provider, client, safeReturnTo(client, redirect, deps.mobileRedirectAllowlist));
    },
  );

  app.openapi(
    createRoute({
      method: 'get',
      path: '/auth/link/{provider}',
      tags: ['auth'],
      summary: 'Link Google or Apple to the signed-in account (redirects to the provider; web).',
      request: { params: providerParam, query: z.object({ redirect: z.string().max(500).optional() }) },
      responses: { 302: { description: 'To the provider.' }, ...authErrors, ...commonErrors },
    }),
    async (c) => {
      const { identity } = requireAuth(c);
      const sub = await subFor(deps.db, identity.userId);
      if (!sub) throw errors.unauthenticated();
      const returnTo = safeReturnTo('web', c.req.valid('query').redirect, deps.mobileRedirectAllowlist);
      return start(c, c.req.valid('param').provider, 'web', returnTo, { userId: identity.userId, sub });
    },
  );

  // Google returns with GET; Apple posts the form (response_mode=form_post), with `user` on the
  // very first authorization only.
  const callback = async (c: Context<ApiEnv>) => {
    const form = c.req.method === 'POST' ? await c.req.parseBody() : {};
    const params = { ...c.req.query(), ...form } as Record<string, string | undefined>;
    if (!params.code || !params.state) throw errors.validation({ callback: 'missing code or state' });
    // Single use: a replayed state finds nothing.
    const raw = await deps.valkey.getdel(`oauth:${params.state}`);
    if (!raw) throw errors.validation({ state: 'unknown or expired' }, 'That sign-in link has expired. Start again.');
    const pending = JSON.parse(raw) as PendingLogin;
    let appleUser: { name?: { firstName?: string; lastName?: string } } | null = null;
    try {
      appleUser = params.user ? (JSON.parse(params.user) as typeof appleUser) : null;
    } catch {
      appleUser = null;
    }
    if (pending.link) {
      // Linking answers the browser with a redirect either way: the settings page reads the outcome.
      const target = new URL(`${deps.appOrigin}${pending.returnTo}`);
      try {
        await deps.idp.linkFederated(pending.link.sub, pending.provider, { code: params.code, codeVerifier: pending.verifier, nonce: pending.nonce, redirectUri, appleUser });
        await deps.auth.securityEvent(pending.link.userId, 'provider_linked', requestMeta(c));
        target.searchParams.set('linked', pending.provider);
      } catch (error) {
        if (!(error instanceof AuthError)) throw error;
        target.searchParams.set('link_error', error.message === error.failure ? 'failed' : 'already_linked');
      }
      return c.redirect(target.toString(), 302);
    }
    const result = await deps.idp
      .completeFederated(pending.provider, { code: params.code, codeVerifier: pending.verifier, nonce: pending.nonce, redirectUri, appleUser }, `nextkin-${pending.client}`)
      .catch(authErrorToApp);
    const signedIn = await deps.auth.complete(result, pending.client, requestMeta(c)).catch(authErrorToApp);
    if (result.linked) await deps.auth.securityEvent(signedIn.user.id, 'provider_linked', requestMeta(c));
    if (pending.client === 'web') {
      c.header('Set-Cookie', signedIn.cookie!);
      return c.redirect(`${deps.appOrigin}${pending.returnTo}`, 302);
    }
    const code = await deps.auth.parkHandoff(signedIn);
    const target = new URL(pending.returnTo);
    target.searchParams.set('code', code);
    return c.redirect(target.toString(), 302);
  };
  app.get('/auth/callback', callback);
  app.post('/auth/callback', callback);

  app.openapi(
    createRoute({
      method: 'post',
      path: '/auth/token/exchange',
      tags: ['auth'],
      summary: 'Mobile: swap the one-time code from the federated redirect for tokens.',
      request: { body: { required: true, content: { 'application/json': { schema: exchangeSchema } } } },
      responses: { 200: { description: 'Signed in.', content: { 'application/json': { schema: mobileSessionSchema } } }, ...authErrors, ...commonErrors },
    }),
    async (c) => {
      const signedIn = await deps.auth.takeHandoff(c.req.valid('json').code);
      if (!signedIn?.tokens) throw errors.unauthenticated();
      return c.json(checked(mobileSessionSchema, { user: signedIn.user, tokens: signedIn.tokens }), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/auth/token/refresh',
      tags: ['auth'],
      summary: 'Mobile: rotate the refresh token. Reusing an old one ends the session.',
      request: { body: { required: true, content: { 'application/json': { schema: refreshSchema } } } },
      responses: { 200: { description: 'New tokens.', content: { 'application/json': { schema: tokenSetSchema } } }, ...authErrors, ...commonErrors },
    }),
    async (c) => {
      try {
        const tokens = await deps.idp.refresh(c.req.valid('json').refreshToken);
        // The server session must still be alive: a logout elsewhere beats a refresh.
        if (!(await deps.sessions.get(tokens.sessionRef))) {
          await deps.idp.revokeSession(tokens.sessionRef);
          throw errors.unauthenticated();
        }
        return c.json(checked(tokenSetSchema, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn }), 200);
      } catch (error) {
        if (error instanceof AuthError && error.failure === 'token_reused' && error.sessionRef) {
          // Theft signal: the provider revoked the token family; end the server session too, so
          // even an unexpired access token from it stops working on the next request.
          await deps.sessions.destroy(error.sessionRef);
        }
        return authErrorToApp(error);
      }
    },
  );

  if (deps.jwks) {
    // Local identity provider only: the keys its tokens are signed with.
    app.get('/local-idp/.well-known/jwks.json', async (c) => c.json(await deps.jwks!()));
  }

  return app;
}
