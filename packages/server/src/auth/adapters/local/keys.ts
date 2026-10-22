import { randomUUID } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, importJWK, jwtVerify, SignJWT, type JWK, type JWTPayload } from 'jose';
import type pg from 'pg';

/**
 * ES256 signing keys for the local identity provider, persisted in local_idp.signing_keys so
 * tokens survive a restart. The issuer is a URN that no cloud verifier will ever accept (L3).
 */
export const LOCAL_ISSUER = 'urn:nextkin:local-idp';
export const ACCESS_TOKEN_SECONDS = 60 * 60; // spec §9.4.1: 60-minute access tokens

interface LoadedKey {
  kid: string;
  privateKey: CryptoKey | Uint8Array;
  publicJwk: JWK;
}

export interface LocalKeys {
  sign(claims: JWTPayload & { sub: string; aud: string }): Promise<string>;
  verify(token: string): Promise<JWTPayload>;
  jwks(): Promise<{ keys: JWK[] }>;
}

export function createLocalKeys(pool: pg.Pool): LocalKeys {
  let loaded: Promise<LoadedKey[]> | null = null;

  async function load(): Promise<LoadedKey[]> {
    const { rows } = await pool.query<{ kid: string; private_jwk: JWK; public_jwk: JWK }>(
      'select kid, private_jwk, public_jwk from local_idp.signing_keys order by created_at desc',
    );
    if (rows.length === 0) {
      const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
      const kid = randomUUID();
      const privateJwk = { ...(await exportJWK(privateKey)), kid, alg: 'ES256', use: 'sig' };
      const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'ES256', use: 'sig' };
      // Two processes starting at once: the loser's insert does nothing and it reloads the winner's.
      await pool.query('insert into local_idp.signing_keys (kid, private_jwk, public_jwk) values ($1, $2, $3) on conflict do nothing', [
        kid,
        privateJwk,
        publicJwk,
      ]);
      return load();
    }
    return Promise.all(
      rows.map(async (row) => ({ kid: row.kid, privateKey: await importJWK(row.private_jwk, 'ES256'), publicJwk: row.public_jwk })),
    );
  }

  const keys = () => (loaded ??= load());

  return {
    async sign(claims) {
      const [current] = await keys();
      return new SignJWT(claims)
        .setProtectedHeader({ alg: 'ES256', kid: current!.kid })
        .setIssuer(LOCAL_ISSUER)
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
        .setJti(randomUUID())
        .sign(current!.privateKey);
    },
    async verify(token) {
      const jwks = createLocalJWKSet({ keys: (await keys()).map((k) => k.publicJwk) });
      const { payload } = await jwtVerify(token, jwks, { issuer: LOCAL_ISSUER, algorithms: ['ES256'], clockTolerance: 5 });
      return payload;
    },
    async jwks() {
      return { keys: (await keys()).map((k) => k.publicJwk) };
    },
  };
}
