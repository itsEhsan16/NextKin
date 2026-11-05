import pg from 'pg';
import { createLocalIdentityProvider } from '../auth/adapters/local/provider';
import { createMemoryEmail } from '../email/email';

/**
 * Local sign-in accounts for the seeded users (ImBackendImplementationPlan P4-05, M0-26). Each
 * account's `sub` is the `identity_sub` the seeded users row already carries, so signing in maps
 * straight onto the seeded data. Staff accounts are not here: they are the server's own
 * (`seed/staff.ts`, toreview §171.13).
 *
 * LOCAL ONLY: one shared, published password and a fixed TOTP secret, so anyone working on the
 * code can sign in as any role. The seed refuses to run outside local and test.
 */
export const SEED_PASSWORD = 'NextKin-local-2026';
// Fixed base32 secret for the suites' staff accounts (`test/integration/fixtures/staffAccounts.ts`).
export const SEED_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

const ACCOUNTS = [
  { sub: 'local|account:free', pool: 'users', email: 'free@nextkin.test', name: 'Fran Free', groups: [] },
  { sub: 'local|account:pro', pool: 'users', email: 'pro@nextkin.test', name: 'Priya Pro', groups: [] },
  { sub: 'local|persona:mobile', pool: 'users', email: 'george.smith@example.com', name: 'George Smith', groups: [] },
  { sub: 'local|persona:web', pool: 'users', email: 'george.smith@gmail.com', name: 'George Smith', groups: [] },
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
      });
    }
    // Only the published credentials are printed; a shared dev's stay in Secrets Manager, out of logs.
    if (!published) return ['accounts use SEED_PASSWORD'];
    return [
      `password for every seeded account: ${SEED_PASSWORD}`,
    ];
  } finally {
    await pool.end();
  }
}
