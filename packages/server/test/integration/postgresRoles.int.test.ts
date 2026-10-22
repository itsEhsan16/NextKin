import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';

/**
 * Database roles (ImBackendImplementationPlan P1-05, ground rule G7). The app role must never be
 * able to bypass row-level security: it is not a superuser, has no BYPASSRLS, and owns nothing.
 */
const config = loadConfig();
const app = new pg.Pool({ connectionString: config.DATABASE_URL, max: 1 });

afterAll(() => app.end());

describe('database roles', () => {
  it('the app role cannot bypass RLS and is not a superuser', async () => {
    const { rows } = await app.query<{ rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean }>(
      `select rolsuper, rolbypassrls, rolcreaterole from pg_roles where rolname = current_user`,
    );
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, rolcreaterole: false });
  });

  it('the app role owns no table, schema or sequence', async () => {
    const { rows } = await app.query<{ n: string }>(
      `select count(*)::text as n from pg_class c join pg_roles r on r.oid = c.relowner
        where r.rolname = 'nextkin_app'`,
    );
    expect(rows[0]?.n).toBe('0');
    const schemas = await app.query(`select nspname from pg_namespace n join pg_roles r on r.oid = n.nspowner where r.rolname = 'nextkin_app'`);
    expect(schemas.rowCount).toBe(0);
  });

  it('the app role cannot create objects in the app schema', async () => {
    await expect(app.query('create table app.should_fail (id int)')).rejects.toThrow(/permission denied/);
  });

  it('runtime limits are set on the app role', async () => {
    const { rows } = await app.query<{ statement_timeout: string }>('show statement_timeout');
    expect(rows[0]?.statement_timeout).toBe('5s');
  });

  it('only allowlisted extensions are installed', async () => {
    const { rows } = await app.query<{ extname: string }>(`select extname from pg_extension order by extname`);
    expect(rows.map((r) => r.extname)).toEqual(['citext', 'pg_trgm', 'pgcrypto', 'plpgsql']);
  });
});
