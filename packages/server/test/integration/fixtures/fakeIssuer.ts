import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { OidcIssuer } from '../../../src/auth/oidc';

/**
 * A minimal OpenID Connect issuer for tests (P4-03): a token endpoint that checks PKCE and returns
 * a signed ID token, and a JWKS endpoint. A test registers what the "provider" should say about the
 * user, then drives the server's callback with the issued code. This stands in for Google and
 * Apple without a container; the mock-oauth2-server profile proves the same flow end to end.
 */
export interface FakeClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export interface FakeIssuer {
  config: OidcIssuer;
  /** Registers a code the token endpoint will accept once, for this challenge and nonce. */
  issueCode(input: { claims: FakeClaims; nonce: string; codeChallenge: string; redirectUri: string }): string;
  close(): Promise<void>;
}

export async function startFakeIssuer(name: string, clientId = 'nextkin-test'): Promise<FakeIssuer> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: `${name}-key`, alg: 'RS256', use: 'sig' };
  const codes = new Map<string, { claims: FakeClaims; nonce: string; codeChallenge: string; redirectUri: string }>();
  let issuer = '';

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', issuer);
    if (url.pathname.endsWith('/jwks')) {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (url.pathname.endsWith('/token') && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const form = new URLSearchParams(body);
      const entry = codes.get(form.get('code') ?? '');
      codes.delete(form.get('code') ?? '');
      const verifier = form.get('code_verifier') ?? '';
      const challengeOk = entry && createHash('sha256').update(verifier).digest('base64url') === entry.codeChallenge;
      if (!entry || !challengeOk || form.get('redirect_uri') !== entry.redirectUri || form.get('client_id') !== clientId) {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'invalid_grant' }));
        return;
      }
      const idToken = await new SignJWT({ ...entry.claims, nonce: entry.nonce })
        .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
        .setIssuer(issuer)
        .setAudience(clientId)
        .setSubject(entry.claims.sub)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id_token: idToken, access_token: randomUUID(), token_type: 'Bearer' }));
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}/${name}`;

  return {
    config: {
      issuer,
      clientId,
      clientSecret: 'test-secret',
      authorizationEndpoint: `${issuer}/authorize`,
      tokenEndpoint: `${issuer}/token`,
      jwksUri: `${issuer}/jwks`,
    },
    issueCode(input) {
      const code = randomUUID();
      codes.set(code, input);
      return code;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
