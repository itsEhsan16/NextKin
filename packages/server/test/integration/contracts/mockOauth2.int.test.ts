import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLocalIdentityProvider } from '../../../src/auth/adapters/local/provider';
import { federationIssuers } from '../../../src/auth/build';
import { pkcePair, randomToken } from '../../../src/auth/oidc';
import type { FederatedProvider } from '../../../src/auth/ports/identity';
import { loadConfig } from '../../../src/config';
import { createMemoryEmail } from '../../../src/email/email';
import { egressHostsFor, setEgressAllowlist } from '../../../src/net/egress';

/**
 * Federated sign-in against the real mock-oauth2-server container (P4-03, re-proved in P13-01),
 * not the in-process fake issuer the identity contract uses. It drives the container's login form,
 * takes the code from the redirect, and completes sign-in through the local adapter: real
 * discovery-shaped endpoints, real signed ID tokens, PKCE and nonce checked by the server.
 *
 * Needs `docker compose --profile auth up -d mock-oauth2`; skipped when the issuer is not reachable.
 */
const config = loadConfig();
const issuers = federationIssuers(config);
const reachable = await fetch(`${config.FEDERATION_GOOGLE_ISSUER}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(2000) })
  .then((r) => r.ok)
  .catch(() => false);

let pool: pg.Pool;
beforeAll(() => {
  pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 2 });
  setEgressAllowlist(egressHostsFor(config));
});
afterAll(async () => {
  await pool?.query(`delete from local_idp.accounts where email like '%@mock-oauth2.test'`);
  await pool?.end();
});

/** Signs in on the mock's interactive form as `sub` with these claims; returns the code. */
async function loginAt(provider: FederatedProvider, claims: Record<string, unknown>) {
  const idp = createLocalIdentityProvider({ pool, email: createMemoryEmail(), issuers });
  const state = randomToken();
  const nonce = randomToken();
  const { verifier, challenge } = pkcePair();
  const redirectUri = 'http://localhost:3000/api/v1/auth/callback';
  const authorize = idp.federatedAuthorizeUrl(provider, { state, nonce, codeChallenge: challenge, redirectUri });
  const form = new URLSearchParams({ username: String(claims.sub), claims: JSON.stringify(claims) });
  const res = await fetch(authorize, { method: 'POST', body: form, redirect: 'manual' });
  const location = new URL(res.headers.get('location') ?? '', redirectUri);
  expect(location.searchParams.get('state')).toBe(state);
  const code = location.searchParams.get('code');
  expect(code).toBeTruthy();
  return { idp, input: { code: code!, codeVerifier: verifier, nonce, redirectUri } };
}

describe.skipIf(!reachable)('federation against mock-oauth2-server (auth profile)', () => {
  it('signs a new user in with Google, then links Apple by the same verified email', async () => {
    const email = `m-${randomUUID().slice(0, 8)}@mock-oauth2.test`;
    const google = await loginAt('google', { sub: `g-${randomUUID()}`, email, email_verified: true, name: 'Morgan Mock' });
    const first = await google.idp.completeFederated('google', google.input, 'nextkin-web');
    expect(first.linked).toBe(false);

    const apple = await loginAt('apple', { sub: `a-${randomUUID()}`, email, email_verified: true });
    const second = await apple.idp.completeFederated('apple', apple.input, 'nextkin-web');
    expect(second.linked).toBe(true);
    expect(second.tokens.accessToken).toBeTruthy();
    expect((await apple.idp.listIdentities(second.profile.sub)).map((i) => i.provider).sort()).toEqual(['apple', 'google']);
  });

  it('refuses a code completed with the wrong PKCE verifier', async () => {
    const { idp, input } = await loginAt('google', { sub: `g-${randomUUID()}`, email: `m-${randomUUID().slice(0, 8)}@mock-oauth2.test`, email_verified: true });
    await expect(idp.completeFederated('google', { ...input, codeVerifier: randomToken(32) }, 'nextkin-web')).rejects.toThrow();
  });
});
