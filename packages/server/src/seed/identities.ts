import pg from 'pg';
import { createLocalIdentityProvider } from '../auth/adapters/local/provider';
import { createMemoryEmail } from '../email/email';
import { otpauthUrl } from '../auth/totp';

/**
 * Local sign-in accounts for the seeded users (ImBackendImplementationPlan P4-05, M0-26). Each
 * account's `sub` is the `identity_sub` the seeded users row already carries, so signing in maps
 * straight onto the seeded data. Staff accounts are in the admins pool and need TOTP.
 *
 * LOCAL ONLY: one shared, published password and a fixed TOTP secret, so anyone working on the
 * code can sign in as any role. The seed refuses to run outside local and test.
 */
export const SEED_PASSWORD = 'NextKin-local-2026';
// Fixed base32 secret: add it to an authenticator app, or generate a code with totpAt() in tests.
export const SEED_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

const ACCOUNTS = [
  { sub: 'local|account:free', pool: 'users', email: 'free@nextkin.test', name: 'Fran Free', groups: [] },
  { sub: 'local|account:pro', pool: 'users', email: 'pro@nextkin.test', name: 'Priya Pro', groups: [] },
  { sub: 'local|persona:mobile', pool: 'users', email: 'george.smith@example.com', name: 'George Smith', groups: [] },
  { sub: 'local|persona:web', pool: 'users', email: 'george.smith@gmail.com', name: 'George Smith', groups: [] },
  { sub: 'local|account:admin', pool: 'admins', email: 'admin@nextkin.test', name: 'Ada Admin', groups: ['admin', 'super_admin'] },
  { sub: 'local|account:curator', pool: 'admins', email: 'curator@nextkin.test', name: 'Cyrus Curator', groups: ['curator'] },
  { sub: 'local|account:support', pool: 'admins', email: 'support@nextkin.test', name: 'Sam Support', groups: ['support'] },
] as const;

/** A shared `dev` passes its own credentials; laptops use the published ones above. */
export interface SeedCredentials {
  password: string;
  totpSecret: string;
}

const PUBLISHED: SeedCredentials = { password: SEED_PASSWORD, totpSecret: SEED_TOTP_SECRET };

export async function seedIdentities(
  databaseUrl: string,
  credentials: SeedCredentials = PUBLISHED,
): Promise<string[]> {
  const published = credentials === PUBLISHED;
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const idp = createLocalIdentityProvider({ pool, email: createMemoryEmail(), issuers: {} });
    for (const account of ACCOUNTS) {
      await idp.upsertAccount({
        sub: account.sub,
        pool: account.pool,
        email: account.email,
        password: credentials.password,
        name: account.name,
        groups: [...account.groups],
        totpSecret: account.pool === 'admins' ? credentials.totpSecret : undefined,
      });
    }
    // Only the published credentials are printed; a shared dev's stay in Secrets Manager, out of logs.
    if (!published) return ['accounts use SEED_PASSWORD; staff TOTP uses SEED_TOTP_SECRET'];
    return [
      `password for every seeded account: ${SEED_PASSWORD}`,
      `staff TOTP (admin@, curator@, support@): ${otpauthUrl(SEED_TOTP_SECRET, 'staff@nextkin.test')}`,
    ];
  } finally {
    await pool.end();
  }
}
