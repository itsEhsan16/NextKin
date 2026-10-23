import type Valkey from 'iovalkey';
import pg from 'pg';
import type { Config } from '../config';
import type { Database } from '../db/database';
import { createSmtpEmail, type EmailPort } from '../email/email';
import type { ApiDeps } from '../http/app';
import { createLocalIdentityProvider, type LocalIdentityProvider } from './adapters/local/provider';
import { mockIssuer, type OidcIssuer } from './oidc';
import { createAuthService } from './service';
import { createSessionStore } from './sessions';

/**
 * Builds the identity stack for a process (ImBackendImplementationPlan P4). The adapter comes from
 * IDENTITY_ADAPTER: `local` today; `cognito` arrives with X-07 and is refused until it exists
 * rather than silently falling back to the stand-in.
 */
export interface IdentityStack {
  identity: NonNullable<ApiDeps['identity']>;
  local?: LocalIdentityProvider;
  close(): Promise<void>;
}

export function federationIssuers(config: Config): Partial<Record<'google' | 'apple', OidcIssuer>> {
  const issuers: Partial<Record<'google' | 'apple', OidcIssuer>> = {};
  if (config.FEDERATION_GOOGLE_ISSUER) issuers.google = mockIssuer(config.FEDERATION_GOOGLE_ISSUER, config.FEDERATION_CLIENT_ID, config.FEDERATION_CLIENT_SECRET);
  if (config.FEDERATION_APPLE_ISSUER) issuers.apple = mockIssuer(config.FEDERATION_APPLE_ISSUER, config.FEDERATION_CLIENT_ID, config.FEDERATION_CLIENT_SECRET);
  return issuers;
}

export function buildIdentity(config: Config, db: Database, valkey: Valkey, overrides: { email?: EmailPort; issuers?: Partial<Record<'google' | 'apple', OidcIssuer>> } = {}): IdentityStack {
  if (config.IDENTITY_ADAPTER !== 'local') {
    throw new Error(`IDENTITY_ADAPTER=${config.IDENTITY_ADAPTER} is not built yet (Connect item X-07).`);
  }
  const idpPool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 4, application_name: 'nextkin-local-idp' });
  // A lost idle client must not crash the process (P13-02); the pool reconnects on the next query.
  idpPool.on('error', (error) => process.emitWarning(`local IdP pool: idle client lost: ${(error as { code?: string }).code ?? error.message}`));
  const local = createLocalIdentityProvider({
    pool: idpPool,
    email: overrides.email ?? createSmtpEmail(config.SMTP_URL, config.EMAIL_FROM),
    issuers: overrides.issuers ?? federationIssuers(config),
  });
  const sessions = createSessionStore(valkey, db);
  const auth = createAuthService({ db, idp: local, sessions, valkey });
  return {
    local,
    identity: {
      idp: local,
      auth,
      sessions,
      valkey,
      apiPublicUrl: config.API_PUBLIC_URL ?? config.APP_ORIGIN,
      mobileRedirectAllowlist: config.MOBILE_REDIRECT_ALLOWLIST.split(',').map((p) => p.trim()).filter(Boolean),
      jwks: () => local.jwks(),
    },
    close: () => idpPool.end(),
  };
}
