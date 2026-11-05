import type Valkey from 'iovalkey';
import pg from 'pg';
import type { Config } from '../config';
import type { Database } from '../db/database';
import { createSmtpEmail, type EmailPort } from '../email/email';
import type { ApiDeps } from '../http/app';
import { createClerkApi, createClerkIdentityProvider, type ClerkIdentityProvider } from './adapters/clerk/provider';
import { createLocalIdentityProvider, type LocalIdentityProvider } from './adapters/local/provider';
import { mockIssuer, type OidcIssuer } from './oidc';
import { createAuthService } from './service';
import { createSessionStore } from './sessions';

/**
 * Builds the identity stack for a process (ImBackendImplementationPlan P4). The adapter comes from
 * IDENTITY_ADAPTER: `local` for tests and the old stack, `clerk` for sign-up now (owner, 2026-11-04,
 * toreview §169); `cognito` arrives with X-07 and is refused until it exists rather than silently
 * falling back to a stand-in.
 */
export interface IdentityStack {
  identity: NonNullable<ApiDeps['identity']>;
  local?: LocalIdentityProvider;
  clerk?: ClerkIdentityProvider;
  close(): Promise<void>;
}

export function federationIssuers(config: Config): Partial<Record<'google' | 'apple', OidcIssuer>> {
  const issuers: Partial<Record<'google' | 'apple', OidcIssuer>> = {};
  if (config.FEDERATION_GOOGLE_ISSUER) issuers.google = mockIssuer(config.FEDERATION_GOOGLE_ISSUER, config.FEDERATION_CLIENT_ID, config.FEDERATION_CLIENT_SECRET);
  if (config.FEDERATION_APPLE_ISSUER) issuers.apple = mockIssuer(config.FEDERATION_APPLE_ISSUER, config.FEDERATION_CLIENT_ID, config.FEDERATION_CLIENT_SECRET);
  return issuers;
}

export function buildIdentity(config: Config, db: Database, valkey: Valkey, overrides: { email?: EmailPort; issuers?: Partial<Record<'google' | 'apple', OidcIssuer>> } = {}): IdentityStack {
  if (config.IDENTITY_ADAPTER === 'clerk') {
    // A session token's `azp` must be one of our own origins (the demo keeps its cloudfront.net one).
    const authorizedParties = [config.APP_ORIGIN, ...config.APP_EXTRA_ORIGINS];
    const clerk = createClerkIdentityProvider(createClerkApi({ secretKey: config.CLERK_SECRET_KEY!, authorizedParties }));
    const sessions = createSessionStore(valkey, db);
    return {
      clerk,
      identity: {
        idp: clerk,
        clerk,
        auth: createAuthService({ db, idp: clerk, sessions, valkey }),
        sessions,
        valkey,
        apiPublicUrl: config.API_PUBLIC_URL ?? config.APP_ORIGIN,
        mobileRedirectAllowlist: config.MOBILE_REDIRECT_ALLOWLIST.split(',').map((p) => p.trim()).filter(Boolean),
      },
      close: async () => {},
    };
  }
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
