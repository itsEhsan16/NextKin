import { Kysely, PostgresDialect, sql, type Transaction } from 'kysely';
import pg from 'pg';
import { withSpan } from '../observability/tracing';
import type { DB } from './types.generated';

/**
 * The only way server code reaches the database (ImBackendImplementationPlan P2-05, G7).
 *
 * Every call opens a transaction and binds the identity with `set_config(..., true)` — scoped to
 * that transaction, so a pooled connection never carries one user's identity into the next
 * request. Raw pools and clients are never exported, and lint forbids importing `pg` outside
 * src/db, so no query path can skip the binding.
 *
 *   withUser       a signed-in user, on the app role: RLS shows only their rows
 *   withAnonymous  public reads (Skills Explorer, plans), on the app role with no user
 *   withSystem     purge and sweep jobs, on the maintenance role; every use is reported
 *   withStaff      support/admin reads, on the read-only role; every use is reported with a reason
 */

export type UserRole = 'user' | 'admin' | 'curator' | 'support';
export type StaffRole = 'admin' | 'curator' | 'support';

export interface Identity {
  userId: string;
  role: UserRole;
}

export type Tx = Transaction<DB>;

export interface AccessEvent {
  kind: 'system' | 'staff';
  purpose: string;
  actorUserId?: string;
  role?: string;
}

export interface Database {
  withUser<T>(identity: Identity, fn: (tx: Tx) => Promise<T>): Promise<T>;
  withAnonymous<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  withSystem<T>(purpose: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
  withStaff<T>(staff: { userId: string; role: StaffRole }, reason: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
  destroy(): Promise<void>;
}

export interface DatabaseOptions {
  appUrl: string;
  maintenanceUrl?: string;
  readonlyUrl?: string;
  poolMax?: number;
  /** Called for every withSystem/withStaff use; the audit trail hangs off this (P12-02). */
  onPrivilegedAccess?: (event: AccessEvent) => void;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class DatabaseAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseAccessError';
  }
}

function connect(url: string, poolMax: number, applicationName: string): Kysely<DB> {
  const pool = new pg.Pool({
    connectionString: url,
    max: poolMax,
    application_name: applicationName,
    // Fail fast instead of queueing forever when the pool is exhausted (R-12).
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
  // An idle client whose server went away (a restart, a failover) emits 'error'. Unhandled, that
  // event crashes the process; handled, the pool drops the client and the next query reconnects
  // (P13-02's Postgres restart drill).
  pool.on('error', (error) => {
    process.emitWarning(`postgres pool (${applicationName}): idle client lost: ${(error as { code?: string }).code ?? error.message}`);
  });
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

async function bind(tx: Tx, userId: string | null, role: string): Promise<void> {
  await sql`select set_config('app.user_id', ${userId ?? ''}, true), set_config('app.role', ${role}, true)`.execute(tx);
}

export function createDatabase(options: DatabaseOptions): Database {
  const poolMax = options.poolMax ?? 10;
  const app = connect(options.appUrl, poolMax, 'nextkin-app');
  const maintenance = options.maintenanceUrl ? connect(options.maintenanceUrl, 2, 'nextkin-maintenance') : undefined;
  const readonly = options.readonlyUrl ? connect(options.readonlyUrl, 2, 'nextkin-staff') : undefined;
  const report = options.onPrivilegedAccess ?? (() => {});

  return {
    async withUser(identity, fn) {
      if (!UUID.test(identity.userId)) throw new DatabaseAccessError('withUser needs a valid user id');
      return withSpan('db.withUser', { 'nextkin.role': identity.role }, () => app.transaction().execute(async (tx) => {
        await bind(tx, identity.userId, identity.role);
        return fn(tx);
      }));
    },

    async withAnonymous(fn) {
      return withSpan('db.withAnonymous', {}, () => app.transaction().execute(async (tx) => {
        await bind(tx, null, 'anonymous');
        return fn(tx);
      }));
    },

    async withSystem(purpose, fn) {
      if (!maintenance) throw new DatabaseAccessError('withSystem needs DATABASE_MAINTENANCE_URL');
      if (!purpose.trim()) throw new DatabaseAccessError('withSystem needs a purpose');
      report({ kind: 'system', purpose });
      return withSpan('db.withSystem', { 'nextkin.purpose': purpose }, () => maintenance.transaction().execute(async (tx) => {
        await bind(tx, null, 'system');
        return fn(tx);
      }));
    },

    async withStaff(staff, reason, fn) {
      if (!readonly) throw new DatabaseAccessError('withStaff needs DATABASE_READONLY_URL');
      if (!UUID.test(staff.userId)) throw new DatabaseAccessError('withStaff needs a valid staff user id');
      if (!reason.trim()) throw new DatabaseAccessError('withStaff needs a recorded reason (spec §7.17)');
      report({ kind: 'staff', purpose: reason, actorUserId: staff.userId, role: staff.role });
      return withSpan('db.withStaff', { 'nextkin.role': staff.role }, () => readonly.transaction().execute(async (tx) => {
        await bind(tx, staff.userId, staff.role);
        return fn(tx);
      }));
    },

    async destroy() {
      await Promise.all([app.destroy(), maintenance?.destroy(), readonly?.destroy()]);
    },
  };
}
