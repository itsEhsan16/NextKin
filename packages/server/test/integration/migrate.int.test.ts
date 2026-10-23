import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { migrate } from '../../src/db/migrate';

/**
 * The migration runner against a scratch database (P2-01), so the real ledger is never touched.
 * Also re-applies the real migrations from empty and proves a second run is a no-op.
 */
const config = loadConfig();
const SCRATCH = 'nextkin_migrate_test';
let ownerUrl: string;

async function asAdmin(statement: string) {
  const client = new pg.Client({ connectionString: config.DATABASE_ADMIN_URL });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await asAdmin(`drop database if exists ${SCRATCH} with (force)`);
  await asAdmin(`create database ${SCRATCH} owner nextkin_owner`);
  const url = new URL(config.DATABASE_OWNER_URL!);
  url.pathname = `/${SCRATCH}`;
  ownerUrl = url.toString();
});

afterAll(async () => {
  await asAdmin(`drop database if exists ${SCRATCH} with (force)`);
});

const dirWith = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'nk-mig-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
};

async function scratchQuery<T extends pg.QueryResultRow>(text: string): Promise<T[]> {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    return (await client.query<T>(text)).rows;
  } finally {
    await client.end();
  }
}

describe('migration runner', () => {
  it('applies files in order and records checksums; a re-run applies nothing', async () => {
    const dir = dirWith({
      '0001_one.sql': 'create table t1 (id int);',
      '0002_two.sql': 'create table t2 (id int);',
    });
    const first = await migrate({ ownerUrl, dir });
    expect(first.applied).toEqual(['0001_one.sql', '0002_two.sql']);
    const second = await migrate({ ownerUrl, dir });
    expect(second).toEqual({ applied: [], alreadyApplied: 2 });
    const ledger = await scratchQuery<{ id: string }>('select id from nk_migrations.applied order by id');
    expect(ledger.map((r) => r.id)).toEqual(['0001_one.sql', '0002_two.sql']);
  });

  it('a failing migration rolls back entirely and is not recorded', async () => {
    const dir = dirWith({
      '0001_one.sql': 'create table t1 (id int);',
      '0002_two.sql': 'create table t2 (id int);',
      '0003_bad.sql': 'create table t3 (id int); select * from does_not_exist;',
    });
    await expect(migrate({ ownerUrl, dir })).rejects.toThrow(/0003_bad.sql failed/);
    const t3 = await scratchQuery(`select to_regclass('public.t3') as t`);
    expect(t3[0]).toEqual({ t: null });
    const ledger = await scratchQuery<{ id: string }>('select id from nk_migrations.applied order by id');
    expect(ledger.map((r) => r.id)).not.toContain('0003_bad.sql');
  });

  it('refuses to run after an applied file is edited', async () => {
    const dir = dirWith({
      '0001_one.sql': 'create table t1 (id int, edited int);',
      '0002_two.sql': 'create table t2 (id int);',
    });
    await expect(migrate({ ownerUrl, dir })).rejects.toThrow(/0001_one.sql was edited/);
  });

  it('honours the no-transaction marker (CREATE INDEX CONCURRENTLY)', async () => {
    const dir = dirWith({
      '0001_one.sql': 'create table t1 (id int);',
      '0002_two.sql': 'create table t2 (id int);',
      '0003_index.sql': '-- migrate:no-transaction\ncreate index concurrently t2_id_idx on t2 (id);',
    });
    const result = await migrate({ ownerUrl, dir });
    expect(result.applied).toEqual(['0003_index.sql']);
  });

  it('two runners at once: one applies, the other waits on the lock and finds nothing to do', async () => {
    const dir = dirWith({
      '0001_one.sql': 'create table t1 (id int);',
      '0002_two.sql': 'create table t2 (id int);',
      '0003_index.sql': '-- migrate:no-transaction\ncreate index concurrently t2_id_idx on t2 (id);',
      '0004_slow.sql': 'select pg_sleep(1); create table t4 (id int);',
    });
    const [x, y] = await Promise.all([migrate({ ownerUrl, dir }), migrate({ ownerUrl, dir })]);
    const applied = [...x.applied, ...y.applied];
    expect(applied).toEqual(['0004_slow.sql']);
  });

  it('applies the real migrations to an empty database', async () => {
    await asAdmin(`drop database if exists ${SCRATCH} with (force)`);
    await asAdmin(`create database ${SCRATCH} owner nextkin_owner`);
    const dir = join(import.meta.dirname, '../../../../aws/migrations');
    const result = await migrate({ ownerUrl, dir });
    expect(result.applied.length).toBeGreaterThanOrEqual(6);
    expect((await migrate({ ownerUrl, dir })).applied).toEqual([]);
  });
});
