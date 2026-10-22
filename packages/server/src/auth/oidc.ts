import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, customFetch, jwtVerify, type JWTPayload } from 'jose';

import { guardedFetch } from '../net/egress';

/**
 * A minimal OpenID Connect relying party for Google and Apple (ImBackendImplementationPlan P4-03):
 * Authorization Code with PKCE (S256), `state` and `nonce`, and full ID-token validation (issuer,
 * audience, expiry, signature against the issuer's JWKS, nonce). Locally the issuers are
 * mock-oauth2-server; in production Cognito federates and this code is not used (X-07).
 */

export interface OidcIssuer {
  issuer: string;
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
}

/** Endpoints for a mock-oauth2-server issuer (or any issuer with the same path layout). */
export function mockIssuer(issuer: string, clientId: string, clientSecret: string): OidcIssuer {
  const base = issuer.replace(/\/$/, '');
  return {
    issuer: base,
    clientId,
    clientSecret,
    authorizationEndpoint: `${base}/authorize`,
    tokenEndpoint: `${base}/token`,
    jwksUri: `${base}/jwks`,
  };
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken(32);
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

export function authorizeUrl(issuer: OidcIssuer, params: { state: string; nonce: string; codeChallenge: string; redirectUri: string }): string {
  const url = new URL(issuer.authorizationEndpoint);
  url.search = new URLSearchParams({
    client_id: issuer.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: params.redirectUri,
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function exchangeCode(
  issuer: OidcIssuer,
  input: { code: string; codeVerifier: string; redirectUri: string; nonce: string },
): Promise<JWTPayload & { sub: string }> {
  const response = await guardedFetch(issuer.tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
      client_id: issuer.clientId,
      client_secret: issuer.clientSecret,
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`token endpoint answered ${response.status}`);
  const body = (await response.json()) as { id_token?: string };
  if (!body.id_token) throw new Error('no id_token in the token response');

  let jwks = jwksCache.get(issuer.jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(issuer.jwksUri), { [customFetch]: guardedFetch });
    jwksCache.set(issuer.jwksUri, jwks);
  }
  const { payload } = await jwtVerify(body.id_token, jwks, { issuer: issuer.issuer, audience: issuer.clientId, clockTolerance: 30 });
  if (payload.nonce !== input.nonce) throw new Error('nonce mismatch');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('id_token has no sub');
  return payload as JWTPayload & { sub: string };
}
