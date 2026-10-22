import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pg from 'pg';
import { loadConfig } from '../config';
import { migrate, MigrationError } from '../db/migrate';

/**
 * The `migrate` task (spec §9.5): run once per deploy, as the owner role, before the new version
 * takes traffic. `--rebaseline` (L8) is local-only: it drops the app schema and re-applies
 * everything, which is allowed only until the first shared environment exists.
 */
const config = loadConfig();
const rebaseline = process.argv.includes('--rebaseline');

if (!config.DATABASE_OWNER_URL) {
  console.error('migrate: DATABASE_OWNER_URL is required (the owner role runs migrations).');
  process.exit(1);
}
if (rebaseline && !['local', 'test'].includes(config.APP_ENV)) {
  console.error(`migrate: --rebaseline is refused in ${config.APP_ENV}. Write a new forward migration.`);
  process.exit(1);
}

try {
  const dir = resolve(config.MIGRATIONS_DIR);
  const result = await migrate({ ownerUrl: config.DATABASE_OWNER_URL, dir, rebaseline, log: (m) => console.log(`migrate: ${m}`) });
  console.log(
    result.applied.length
      ? `migrate: ${result.applied.length} applied, ${result.alreadyApplied} already in place`
      : `migrate: up to date (${result.alreadyApplied} applied)`,
  );
  // The local identity provider's store: applied only when it is the active adapter (L3). It is
  // not part of aws/migrations, so it can never reach a deployed database.
  if (config.IDENTITY_ADAPTER === 'local') {
    const client = new pg.Client({ connectionString: config.DATABASE_OWNER_URL });
    await client.connect();
    try {
      await client.query(readFileSync(join(import.meta.dirname, '../auth/adapters/local/schema.sql'), 'utf8'));
      console.log('migrate: local identity provider schema in place');
    } finally {
      await client.end();
    }
  }
} catch (error) {
  console.error(error instanceof MigrationError ? `migrate: ${error.message}` : error);
  process.exit(1);
}
