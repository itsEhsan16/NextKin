import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

/**
 * The migration runner (ImBackendImplementationPlan P2-01; rules in aws/migrations/README.md).
 *
 *  - Applies aws/migrations/NNNN_name.sql in order, forward only, as the owner role.
 *  - Records each file's SHA-256 in nk_migrations.applied and refuses to run if an applied file
 *    was edited, deleted, or if a new file sorts before the last applied one.
 *  - Each file runs in one transaction unless its first line is `-- migrate:no-transaction`
 *    (CREATE INDEX CONCURRENTLY, for example).
 *  - A session advisory lock means two runners (two deploys, a deploy and a laptop) never race.
 *  - `rebaseline` (L8) drops the app schema and re-applies everything. It is refused outside
 *    local and test, and must be refused for good once a shared environment exists.
 */

export const MIGRATION_FILE = /^(\d{4})_[a-z0-9_]+\.sql$/;
const LOCK_KEY = 7_366_201_001; // arbitrary, fixed: "nextkin.migrate"
const NO_TRANSACTION = '-- migrate:no-transaction';

export interface MigrationFile {
  id: string;
  sql: string;
  checksum: string;
}

export interface MigrateResult {
  applied: string[];
  alreadyApplied: number;
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export function readMigrations(dir: string): MigrationFile[] {
  const names = readdirSync(dir).filter((f) => f.endsWith('.sql'));
  const bad = names.filter((f) => !MIGRATION_FILE.test(f));
  if (bad.length) throw new MigrationError(`badly named migration file(s): ${bad.join(', ')} (want NNNN_snake_case.sql)`);
  const files = names.sort().map((id) => {
    const sql = readFileSync(join(dir, id), 'utf8').replace(/\r\n/g, '\n');
    return { id, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  });
  const numbers = files.map((f) => f.id.slice(0, 4));
  const duplicate = numbers.find((n, i) => numbers.indexOf(n) !== i);
  if (duplicate) throw new MigrationError(`two migrations share the number ${duplicate}`);
  return files;
}

interface AppliedRow {
  id: string;
  checksum: string;
}

/** Throws unless the applied ledger is an unedited prefix of the files on disk. */
export function planMigrations(files: MigrationFile[], applied: AppliedRow[]): MigrationFile[] {
  const byId = new Map(files.map((f) => [f.id, f]));
  for (const row of applied) {
    const file = byId.get(row.id);
    if (!file) throw new MigrationError(`applied migration ${row.id} is missing from disk; never delete a migration`);
    if (file.checksum !== row.checksum) {
      throw new MigrationError(`applied migration ${row.id} was edited after it ran; write a new migration instead`);
    }
  }
  const appliedIds = new Set(applied.map((r) => r.id));
  const pending = files.filter((f) => !appliedIds.has(f.id));
  const lastApplied = applied.map((r) => r.id).sort().at(-1);
  const early = lastApplied ? pending.find((f) => f.id < lastApplied) : undefined;
  if (early) {
    throw new MigrationError(`migration ${early.id} sorts before the already-applied ${lastApplied}; renumber it after the last one`);
  }
  return pending;
}

async function ensureLedger(client: pg.ClientBase): Promise<void> {
  await client.query('CREATE SCHEMA IF NOT EXISTS nk_migrations');
  await client.query(`
    CREATE TABLE IF NOT EXISTS nk_migrations.applied (
      id          text PRIMARY KEY,
      checksum    text NOT NULL,
      duration_ms integer NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )`);
}

export interface MigrateOptions {
  ownerUrl: string;
  dir: string;
  rebaseline?: boolean;
  log?: (message: string) => void;
}

export async function migrate(options: MigrateOptions): Promise<MigrateResult> {
  const log = options.log ?? (() => {});
  const files = readMigrations(options.dir);
  const client = new pg.Client({ connectionString: options.ownerUrl });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await ensureLedger(client);

    if (options.rebaseline) {
      log('rebaseline: dropping schema app and clearing the ledger');
      await client.query('DROP SCHEMA IF EXISTS app CASCADE');
      await client.query('TRUNCATE nk_migrations.applied');
    }

    const { rows } = await client.query<AppliedRow>('SELECT id, checksum FROM nk_migrations.applied ORDER BY id');
    const pending = planMigrations(files, rows);

    for (const file of pending) {
      const started = Date.now();
      const transactional = !file.sql.trimStart().startsWith(NO_TRANSACTION);
      try {
        if (transactional) await client.query('BEGIN');
        // A no-transaction file holds one statement (CREATE INDEX CONCURRENTLY cannot share an
        // implicit transaction block), so its timeouts are set on the session first.
        else await client.query("SET lock_timeout = '5s'; SET statement_timeout = '10min'");
        await client.query(file.sql);
        await client.query('INSERT INTO nk_migrations.applied (id, checksum, duration_ms) VALUES ($1, $2, $3)', [
          file.id,
          file.checksum,
          Date.now() - started,
        ]);
        if (transactional) await client.query('COMMIT');
      } catch (error) {
        if (transactional) await client.query('ROLLBACK').catch(() => {});
        const message = error instanceof Error ? error.message : String(error);
        throw new MigrationError(`${file.id} failed: ${message}`);
      }
      log(`applied ${file.id} (${Date.now() - started} ms)`);
    }
    return { applied: pending.map((f) => f.id), alreadyApplied: rows.length };
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    await client.end();
  }
}
