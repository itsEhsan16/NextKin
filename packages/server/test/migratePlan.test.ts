import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MigrationError, planMigrations, readMigrations, type MigrationFile } from '../src/db/migrate';

const file = (id: string, checksum = `sum-${id}`): MigrationFile => ({ id, sql: '', checksum });

describe('planMigrations', () => {
  const files = [file('0001_a.sql'), file('0002_b.sql'), file('0003_c.sql')];

  it('returns every file on an empty ledger, in order', () => {
    expect(planMigrations(files, []).map((f) => f.id)).toEqual(['0001_a.sql', '0002_b.sql', '0003_c.sql']);
  });

  it('returns only the files after the applied prefix', () => {
    const applied = [{ id: '0001_a.sql', checksum: 'sum-0001_a.sql' }];
    expect(planMigrations(files, applied).map((f) => f.id)).toEqual(['0002_b.sql', '0003_c.sql']);
  });

  it('refuses an applied migration that was edited', () => {
    expect(() => planMigrations(files, [{ id: '0001_a.sql', checksum: 'different' }])).toThrow(/was edited/);
  });

  it('refuses an applied migration that was deleted', () => {
    expect(() => planMigrations(files, [{ id: '0000_gone.sql', checksum: 'x' }])).toThrow(/missing from disk/);
  });

  it('refuses a new migration numbered before the last applied one', () => {
    const applied = [
      { id: '0001_a.sql', checksum: 'sum-0001_a.sql' },
      { id: '0003_c.sql', checksum: 'sum-0003_c.sql' },
    ];
    expect(() => planMigrations(files, applied)).toThrow(MigrationError);
    expect(() => planMigrations(files, applied)).toThrow(/sorts before/);
  });
});

describe('readMigrations', () => {
  const dirWith = (names: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'nk-migrations-'));
    for (const [name, body] of Object.entries(names)) writeFileSync(join(dir, name), body);
    return dir;
  };

  it('normalises line endings so a Windows checkout has the same checksum', () => {
    const lf = readMigrations(dirWith({ '0001_a.sql': 'select 1;\nselect 2;\n' }));
    const crlf = readMigrations(dirWith({ '0001_a.sql': 'select 1;\r\nselect 2;\r\n' }));
    expect(crlf[0]!.checksum).toBe(lf[0]!.checksum);
  });

  it('rejects badly named files and duplicate numbers', () => {
    expect(() => readMigrations(dirWith({ 'add_users.sql': '' }))).toThrow(/badly named/);
    expect(() => readMigrations(dirWith({ '0001_a.sql': '', '0001_b.sql': '' }))).toThrow(/share the number/);
  });

  it('reads the real migrations folder', () => {
    const files = readMigrations(join(import.meta.dirname, '../../../aws/migrations'));
    expect(files[0]!.id).toBe('0001_foundation.sql');
  });
});
