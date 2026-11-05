import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { createUserGraph, ensureReferenceData, type UserGraph } from './fixtures/userGraph';

/**
 * The RLS adversarial suite (ImBackendImplementationPlan P2-06, ground rule G7, spec §16.6).
 *
 * Tables are discovered from the catalog, not listed by hand, so a new table that ships without
 * row-level security fails here on its own. For every user-owned table, user B must not be able to
 * read, change or delete user A's rows, and A must not be able to hand a row to B.
 */

const config = loadConfig();
let db: Database;
let owner: pg.Pool;
let a: UserGraph;
let b: UserGraph;

interface OwnedTable {
  table: string;
  ownerColumn: string;
}

const DISCOVER_OWNED = `
  select c.relname as table, a.attname as "ownerColumn"
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'app'
  join pg_attribute a on a.attrelid = c.oid and not a.attisdropped
  where c.relkind = 'r'
    and (a.attname in ('user_id', 'owner_user_id') or (c.relname = 'users' and a.attname = 'id'))
    -- Staff credentials (toreview §171.13): linked to a users row but never the user's to read;
    -- only the system role touches them, so they have no owner policy by design.
    and c.relname not in ('staff_accounts')
  order by c.relname`;

/** Every table in the app schema must have RLS enabled and forced, with at least one policy. */
const FIND_UNPROTECTED = `
  select c.relname as table, c.relrowsecurity as enabled, c.relforcerowsecurity as forced,
         (select count(*) from pg_policy p where p.polrelid = c.oid)::int as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'app'
  where c.relkind = 'r'
    and (not c.relrowsecurity or not c.relforcerowsecurity
         or not exists (select 1 from pg_policy p where p.polrelid = c.oid))`;

beforeAll(async () => {
  db = createDatabase({
    appUrl: config.DATABASE_URL,
    maintenanceUrl: config.DATABASE_MAINTENANCE_URL,
    readonlyUrl: config.DATABASE_READONLY_URL,
    poolMax: 2,
  });
  owner = new pg.Pool({ connectionString: config.DATABASE_OWNER_URL, max: 1 });
  const { rubricVersionId } = await ensureReferenceData(db, randomUUID());
  a = await createUserGraph(db, 'alice', rubricVersionId);
  b = await createUserGraph(db, 'bob', rubricVersionId);
});

afterAll(async () => {
  // Leave the dev database as it was: the cascade removes everything the two users owned.
  await db.withSystem('RLS suite cleanup', (tx) => tx.deleteFrom('users').where('id', 'in', [a.userId, b.userId]).execute());
  await db.destroy();
  await owner.end();
});

async function ownedTables(): Promise<OwnedTable[]> {
  const { rows } = await owner.query<OwnedTable>(DISCOVER_OWNED);
  return rows;
}

describe('catalog: every table is protected', () => {
  it('discovers the user-owned tables (sanity: the schema has them)', async () => {
    const tables = await ownedTables();
    expect(tables.length).toBeGreaterThanOrEqual(30);
  });

  it('every table in app has RLS enabled, forced, and at least one policy', async () => {
    const { rows } = await owner.query(FIND_UNPROTECTED);
    expect(rows).toEqual([]);
  });

  it('a new table without RLS would be caught (probe inside a rolled-back transaction)', async () => {
    const client = await owner.connect();
    try {
      await client.query('begin');
      await client.query('create table app.rls_probe (id int, user_id uuid)');
      const { rows } = await client.query<{ table: string }>(FIND_UNPROTECTED);
      expect(rows.map((r) => r.table)).toContain('rls_probe');
    } finally {
      await client.query('rollback');
      client.release();
    }
  });

  it('every user-owned table has the owner policy for the app role', async () => {
    const { rows } = await owner.query<{ table: string }>(`
      select c.relname as table from pg_class c
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'app'
      where c.relkind = 'r' and c.relname = any($1)
        and not exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polname = 'owner_access')`,
      [(await ownedTables()).map((t) => t.table)]);
    expect(rows).toEqual([]);
  });
});

describe('cross-user matrix (user B attacks user A)', () => {
  it('the fixture covers every user-owned table (extend fixtures/userGraph.ts for new tables)', async () => {
    const missing: string[] = [];
    for (const { table, ownerColumn } of await ownedTables()) {
      const n = await db.withUser({ userId: a.userId, role: 'user' }, async (tx) => {
        const r = await sql<{ n: number }>`select count(*)::int as n from ${sql.table(`app.${table}`)} where ${sql.ref(ownerColumn)} = ${a.userId}`.execute(tx);
        return r.rows[0]!.n;
      });
      if (n === 0) missing.push(table);
    }
    expect(missing).toEqual([]);
  });

  it('B can read none of A\'s rows in any user-owned table', async () => {
    const leaks: string[] = [];
    for (const { table, ownerColumn } of await ownedTables()) {
      const n = await db.withUser({ userId: b.userId, role: 'user' }, async (tx) => {
        const r = await sql<{ n: number }>`select count(*)::int as n from ${sql.table(`app.${table}`)} where ${sql.ref(ownerColumn)} = ${a.userId}`.execute(tx);
        return r.rows[0]!.n;
      });
      if (n > 0) leaks.push(`${table}: ${n}`);
    }
    expect(leaks).toEqual([]);
  });

  it('B can update and delete none of A\'s rows', async () => {
    const touched: string[] = [];
    for (const { table, ownerColumn } of await ownedTables()) {
      const counts = await db.withUser({ userId: b.userId, role: 'user' }, async (tx) => {
        const target = sql.table(`app.${table}`);
        const col = sql.ref(ownerColumn);
        // Self-assignment touches nothing but proves whether B can reach the row at all.
        const updated = await sql`update ${target} set ${col} = ${col} where ${col} = ${a.userId}`.execute(tx).catch(() => ({ numAffectedRows: 0n }));
        const deleted = await sql`delete from ${target} where ${col} = ${a.userId}`.execute(tx).catch(() => ({ numAffectedRows: 0n }));
        return Number(updated.numAffectedRows ?? 0n) + Number(deleted.numAffectedRows ?? 0n);
      });
      if (counts > 0) touched.push(`${table}: ${counts}`);
    }
    expect(touched).toEqual([]);
    // A still has every row.
    const users = await db.withUser({ userId: a.userId, role: 'user' }, (tx) =>
      tx.selectFrom('resumes').select('id').where('user_id', '=', a.userId).execute(),
    );
    expect(users.length).toBeGreaterThan(0);
  });

  it('A cannot reassign a row to B, and B cannot insert a row claiming to be A', async () => {
    await expect(
      db.withUser({ userId: a.userId, role: 'user' }, (tx) =>
        tx.updateTable('resumes').set({ user_id: b.userId }).where('id', '=', a.ids.resume!).execute(),
      ),
    ).rejects.toThrow(/row-level security|violates/);
    await expect(
      db.withUser({ userId: b.userId, role: 'user' }, (tx) =>
        tx.insertInto('activity').values({ user_id: a.userId, kind: 'forged', title: 'forged' }).execute(),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      db.withUser({ userId: b.userId, role: 'user' }, (tx) =>
        tx.insertInto('users').values({ id: randomUUID(), identity_sub: `forged|${randomUUID()}`, email: `f-${randomUUID()}@example.test` }).execute(),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('an anonymous session sees no user-owned rows at all', async () => {
    const seen: string[] = [];
    for (const { table } of await ownedTables()) {
      const n = await db.withAnonymous(async (tx) => {
        const r = await sql<{ n: number }>`select count(*)::int as n from ${sql.table(`app.${table}`)}`.execute(tx);
        return r.rows[0]!.n;
      });
      if (n > 0) seen.push(table);
    }
    expect(seen).toEqual([]);
  });
});

describe('the app role cannot get around RLS', () => {
  const asApp = async (statement: string) => {
    const client = new pg.Client({ connectionString: config.DATABASE_URL });
    await client.connect();
    try {
      return await client.query(statement);
    } finally {
      await client.end();
    }
  };

  it('cannot disable or bypass row-level security', async () => {
    await expect(asApp('alter table app.resumes disable row level security')).rejects.toThrow(/must be owner/);
    await expect(asApp('alter table app.resumes no force row level security')).rejects.toThrow(/must be owner/);
    await expect(asApp('set role nextkin_owner')).rejects.toThrow(/permission denied/);
    await expect(asApp('set session authorization nextkin_owner')).rejects.toThrow(/permission denied/);
    await expect(asApp("set row_security = off; select * from app.resumes")).rejects.toThrow(/row-level security/);
  });

  it('cannot run the RLS helper functions', async () => {
    await expect(asApp("select app.apply_owner_rls('app.resumes')")).rejects.toThrow(/permission denied/);
  });

  it('a pooled connection carries no identity into the next transaction', async () => {
    const single = createDatabase({ appUrl: config.DATABASE_URL, poolMax: 1 });
    try {
      await single.withUser({ userId: a.userId, role: 'user' }, async (tx) => {
        await tx.selectFrom('resumes').select('id').execute();
      });
      await single
        .withUser({ userId: a.userId, role: 'user' }, async () => {
          throw new Error('boom');
        })
        .catch(() => {});
      const leaked = await single.withAnonymous(async (tx) => {
        const r = await sql<{ uid: string; role: string }>`select current_setting('app.user_id', true) as uid, current_setting('app.role', true) as role`.execute(tx);
        return r.rows[0]!;
      });
      expect(leaked.uid).toBe('');
      expect(leaked.role).toBe('anonymous');
      // And outside any transaction, the setting is gone entirely.
      const visible = await single.withAnonymous((tx) => tx.selectFrom('resumes').select('id').execute());
      expect(visible).toEqual([]);
    } finally {
      await single.destroy();
    }
  });
});

describe('privileged paths', () => {
  it('withStaff (read-only role) can read across users, and cannot write', async () => {
    const staffId = randomUUID();
    const rows = await db.withStaff({ userId: staffId, role: 'support' }, 'RLS suite check', (tx) =>
      tx.selectFrom('resumes').select('user_id').where('user_id', 'in', [a.userId, b.userId]).execute(),
    );
    expect(new Set(rows.map((r) => r.user_id))).toEqual(new Set([a.userId, b.userId]));
    await expect(
      db.withStaff({ userId: staffId, role: 'admin' }, 'RLS suite check', (tx) =>
        tx.deleteFrom('activity').where('user_id', '=', a.userId).execute(),
      ),
    ).rejects.toThrow(/permission denied|read-only/);
  });

  it('the read-only role sees nothing without a staff identity bound', async () => {
    const client = new pg.Client({ connectionString: config.DATABASE_READONLY_URL });
    await client.connect();
    try {
      const { rows } = await client.query('select count(*)::int as n from app.resumes');
      expect(rows[0].n).toBe(0);
    } finally {
      await client.end();
    }
  });

  it('withSystem (maintenance role) can purge across users but cannot create user rows', async () => {
    const purged = await db.withSystem('RLS suite check', (tx) =>
      tx.deleteFrom('idempotency_keys').where('user_id', '=', b.userId).executeTakeFirst(),
    );
    expect(Number(purged.numDeletedRows)).toBe(1);
    await expect(
      db.withSystem('RLS suite check', (tx) =>
        tx.insertInto('activity').values({ user_id: a.userId, kind: 'x', title: 'x' }).execute(),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('the audit log is append-only even for its writers', async () => {
    await db.withUser({ userId: a.userId, role: 'admin' }, (tx) =>
      tx.insertInto('audit_logs').values({ actor_user_id: a.userId, actor_role: 'admin', action: 'rls.suite' }).execute(),
    );
    await expect(
      db.withSystem('RLS suite check', (tx) => tx.deleteFrom('audit_logs').where('action', '=', 'rls.suite').execute()),
    ).rejects.toThrow(/permission denied|append-only/);
  });

  it('resume versions are immutable', async () => {
    await expect(
      db.withUser({ userId: a.userId, role: 'user' }, (tx) =>
        tx.updateTable('resume_versions').set({ change_note: 'rewritten' }).where('id', '=', a.ids.resumeVersion!).execute(),
      ),
    ).rejects.toThrow(/immutable/);
    // The two fields filled in after the fact are allowed.
    await db.withUser({ userId: a.userId, role: 'user' }, (tx) =>
      tx.updateTable('resume_versions').set({ accuracy_confirmed_at: sql<Date>`now()` }).where('id', '=', a.ids.resumeVersion!).execute(),
    );
  });
});

describe('account deletion', () => {
  it('deleting a user leaves no row in any user-owned table', async () => {
    const { rubricVersionId } = await ensureReferenceData(db, randomUUID());
    const c = await createUserGraph(db, 'carol', rubricVersionId);
    await db.withSystem('RLS suite: delete a user', (tx) => tx.deleteFrom('users').where('id', '=', c.userId).execute());
    const left: string[] = [];
    for (const { table, ownerColumn } of await ownedTables()) {
      const r = await db.withSystem('RLS suite: count what is left', (tx) => sql<{ n: number }>`select count(*)::int as n from ${sql.table(`app.${table}`)} where ${sql.ref(ownerColumn)} = ${c.userId}`.execute(tx));
      if (r.rows[0]!.n > 0) left.push(table);
    }
    expect(left).toEqual([]);
  });
});
