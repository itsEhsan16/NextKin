import type { DataExportStatus } from '@nextkin/shared/models/user';
import JSZip from 'jszip';
import { sql } from 'kysely';

import type { IdentityProvider } from '../auth/ports/identity';
import type { SessionStore } from '../auth/sessions';
import type { Database, Identity } from '../db/database';
import { errors } from '../http/errors';
import type { Logger } from '../observability/logger';
import { enqueue } from '../outbox/outbox';
import type { PaymentProvider } from '../payments/types';
import type { StoragePort } from '../storage/storage';
import { purgeDocuments } from './resumes';

/**
 * Privacy rights (ImBackendImplementationPlan P12-11; V2 §8.5; C-14).
 *
 * - **Export.** The worker builds one archive: every table holding the user's data, discovered from
 *   the catalog (so a new table cannot be left out), read as the user under RLS, plus their files
 *   (uploads and rendered exports). It lands in the exports bucket for 7 days; each read presigns a
 *   fresh 15-minute link.
 * - **Deletion.** At once: every session ends, the identity is deleted at the provider, a paid
 *   subscription is ended at the gateway, the email is released, and the account is marked deleted
 *   (sign-in is refused). The daily purge then removes the files by reference and the user row,
 *   which cascades through every owned table (an RLS-suite test proves no row survives). Backups
 *   age out on their own retention (35 days at most once X-05 sets it); nothing is restored from
 *   them for a deleted account.
 */

const EXPORT_DAYS = 7;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Tables the archive leaves out: secrets and transient plumbing, not the user's data. */
const NOT_EXPORTED = new Set(['idempotency_keys']);
/** Columns that are secrets even inside the user's own archive. */
const REDACT: Record<string, string[]> = { sessions: ['id_hash'], push_devices: ['token', 'endpoint_arn'] };

export interface PrivacyDeps {
  db: Database;
  storage: StoragePort;
  exportsBucket: string;
  uploadsBucket: string;
  log: Logger;
}

const sizeLabel = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

type ExportRow = { id: string; status: string; requested_at: Date | string; ready_at: Date | string | null; expires_at: Date | string | null; size_bytes: unknown; object_key: string | null; error: string | null };

async function toStatus(deps: Pick<PrivacyDeps, 'storage' | 'exportsBucket'>, row: ExportRow | undefined): Promise<DataExportStatus & { url?: string }> {
  if (!row) return { status: 'idle' };
  const expired = row.expires_at !== null && new Date(row.expires_at).getTime() < Date.now();
  if (expired) return { status: 'idle' };
  const base = { requestedAt: new Date(row.requested_at).toISOString(), fileName: 'nextkin-export.zip' };
  if (row.status === 'preparing') return { status: 'preparing', ...base };
  if (row.status === 'failed') return { status: 'failed', ...base, error: row.error ?? 'The archive failed to build. Try again.' };
  const url = await deps.storage.presignGet(deps.exportsBucket, row.object_key!, { seconds: 900, downloadName: 'nextkin-export.zip' });
  return { status: 'ready', ...base, readyAt: new Date(row.ready_at!).toISOString(), expiresAt: new Date(row.expires_at!).toISOString(), sizeLabel: sizeLabel(Number(row.size_bytes ?? 0)), url };
}

export async function getDataExport(deps: Pick<PrivacyDeps, 'db' | 'storage' | 'exportsBucket'>, identity: Identity) {
  const row = await deps.db.withUser(identity, (tx) => tx.selectFrom('data_exports').selectAll().orderBy('requested_at', 'desc').executeTakeFirst());
  return toStatus(deps, row);
}

/** Asks for an archive; one already being built is returned rather than started twice. */
export async function requestDataExport(deps: Pick<PrivacyDeps, 'db' | 'storage' | 'exportsBucket'>, identity: Identity, correlationId: string | null) {
  const row = await deps.db.withUser(identity, async (tx) => {
    const building = await tx.selectFrom('data_exports').selectAll().where('status', '=', 'preparing').executeTakeFirst();
    if (building) return building;
    const created = await tx.insertInto('data_exports').values({ user_id: identity.userId }).returningAll().executeTakeFirstOrThrow();
    await tx.insertInto('security_events').values({ user_id: identity.userId, kind: 'data_export' }).execute();
    await enqueue(tx, { queue: 'maintenance', groupId: `export:${identity.userId}`, type: 'account.export', payload: { exportId: created.id, userId: identity.userId }, correlationId });
    return created;
  });
  return toStatus(deps, row);
}

/** The user-owned tables and their owner column, from the catalog: what the archive must cover. */
export async function ownedTables(db: Database, identity: Identity): Promise<{ table: string; owner: string }[]> {
  const rows = await db.withUser(identity, (tx) =>
    sql<{ table: string; owner: string }>`
      select c.table_name as table, c.column_name as owner
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
      where c.table_schema = 'app'
        and (c.column_name = 'user_id' or (c.table_name = 'users' and c.column_name = 'id') or (c.table_name = 'billing_accounts' and c.column_name = 'owner_user_id'))
        and has_table_privilege(current_user, quote_ident(c.table_schema) || '.' || quote_ident(c.table_name), 'SELECT')
      order by 1`.execute(tx),
  );
  return rows.rows.filter((r) => !NOT_EXPORTED.has(r.table));
}

/** Builds one archive (the worker). Idempotent: a finished export is left alone. */
export async function buildDataExport(deps: PrivacyDeps, input: { exportId: string; userId: string }): Promise<'built' | 'skipped'> {
  const identity: Identity = { userId: input.userId, role: 'user' };
  const row = await deps.db.withUser(identity, (tx) => tx.selectFrom('data_exports').select(['id', 'status']).where('id', '=', input.exportId).executeTakeFirst());
  if (!row || row.status !== 'preparing') return 'skipped';
  try {
    const zip = new JSZip();
    const tables = await ownedTables(deps.db, identity);
    const data: Record<string, unknown[]> = {};
    await deps.db.withUser(identity, async (tx) => {
      for (const { table, owner } of tables) {
        const result = await sql<Record<string, unknown>>`select * from ${sql.table(`app.${table}`)} where ${sql.ref(owner)} = ${input.userId}`.execute(tx);
        data[table] = result.rows.map((r) => {
          const copy = { ...r };
          for (const column of REDACT[table] ?? []) if (column in copy) copy[column] = '[redacted]';
          return copy;
        });
      }
    });
    zip.file('README.txt', `Your NextKin data, exported ${new Date().toISOString()}.\n\ndata.json holds every record we keep about you, one list per table.\nfiles/ holds the documents you uploaded and the files you exported.\n`);
    zip.file('data.json', JSON.stringify({ exportedAt: new Date().toISOString(), tables: data }, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v), 2));
    const uploads = (data.uploads ?? []) as { id: string; bucket: string; object_key: string; file_name: string; status: string }[];
    for (const u of uploads.filter((u) => u.status === 'clean')) {
      const bytes = await deps.storage.read(u.bucket, u.object_key, MAX_FILE_BYTES).catch(() => null);
      if (bytes) zip.file(`files/uploads/${u.id}-${u.file_name.replace(/[^\w.-]+/g, '_')}`, bytes);
    }
    const exports = (data.export_events ?? []) as { id: string; object_key: string | null; file_name: string }[];
    for (const e of exports.filter((e) => e.object_key)) {
      const bytes = await deps.storage.read(deps.exportsBucket, e.object_key!, MAX_FILE_BYTES).catch(() => null);
      if (bytes) zip.file(`files/exports/${e.id}-${e.file_name.replace(/[^\w.-]+/g, '_')}`, bytes);
    }
    const body = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const key = `users/${input.userId}/data-exports/${input.exportId}.zip`;
    await deps.storage.write(deps.exportsBucket, key, body, 'application/zip');
    await deps.db.withUser(identity, (tx) =>
      tx
        .updateTable('data_exports')
        .set({ status: 'ready', object_key: key, size_bytes: body.byteLength, ready_at: sql`now()`, expires_at: sql`now() + make_interval(days => ${EXPORT_DAYS})` })
        .where('id', '=', input.exportId)
        .execute(),
    );
    return 'built';
  } catch (error) {
    deps.log.warn({ event: 'privacy.export_failed', errorName: error instanceof Error ? error.name : typeof error }, 'data export failed');
    await deps.db.withUser(identity, (tx) => tx.updateTable('data_exports').set({ status: 'failed', error: 'The archive failed to build. Try again.' }).where('id', '=', input.exportId).execute());
    return 'built';
  }
}

export interface DeletionDeps {
  db: Database;
  idp: IdentityProvider;
  sessions: SessionStore;
  provider: PaymentProvider;
  log: Logger;
}

/** The irreversible part happens now; the purge removes what is left within a day (§8.5: within 30). */
export async function deleteAccount(deps: DeletionDeps, identity: Identity): Promise<void> {
  const { sub, subscriptionRef } = await deps.db.withUser(identity, async (tx) => {
    const user = await tx.selectFrom('users').select(['identity_sub', 'status']).where('id', '=', identity.userId).executeTakeFirst();
    if (!user || user.status === 'deleted') throw errors.notFound('account');
    const sub = await tx.selectFrom('subscriptions').select('gateway_subscription_id').where('status', 'in', ['active', 'trialing', 'past_due', 'paused']).where('gateway_subscription_id', 'is not', null).executeTakeFirst();
    return { sub: user.identity_sub, subscriptionRef: sub?.gateway_subscription_id ?? null };
  });
  // Paid time ends with the account; nothing renews. A gateway outage is logged and retried by support.
  if (subscriptionRef) {
    await deps.provider.cancelNowAndRefund(subscriptionRef, null).catch((e: unknown) => deps.log.error({ event: 'privacy.cancel_failed', errorName: e instanceof Error ? e.name : typeof e }, 'could not end the subscription at the gateway'));
  }
  for (const record of await deps.sessions.destroyAllForUser(identity.userId)) await deps.idp.revokeSession(record.sessionRef);
  await deps.idp.globalSignOut(sub);
  await deps.idp.deleteAccount(sub);
  await deps.db.withUser(identity, async (tx) => {
    // The address is released at once, so the person can sign up again before the purge runs.
    await tx
      .updateTable('users')
      .set({ status: 'deleted', deletion_requested_at: sql`now()`, email: sql`'deleted+' || id::text || '@deleted.invalid'`, identity_sub: sql`'deleted|' || id::text`, first_name: '', last_name: '' })
      .where('id', '=', identity.userId)
      .execute();
    await tx.insertInto('security_events').values({ user_id: identity.userId, kind: 'deletion_requested' }).execute();
  });
}

/** The daily purge: files by reference, then the user row (cascading through every owned table). */
export async function purgeDeletedAccounts(deps: PrivacyDeps & { avatarsBucket?: string }): Promise<number> {
  const due = await deps.db.withSystem('privacy: find accounts to purge', (tx) => tx.selectFrom('users').select(['id', 'avatar_key']).where('status', '=', 'deleted').limit(100).execute());
  let purged = 0;
  for (const user of due) {
    await deps.db.withSystem('privacy: purge a deleted account', async (tx) => {
      const resumes = await tx.selectFrom('resumes').select('id').where('user_id', '=', user.id).execute();
      await purgeDocuments(tx, deps, resumes.map((r) => r.id));
      const uploads = await tx.selectFrom('uploads').select(['bucket', 'object_key']).where('user_id', '=', user.id).execute();
      for (const u of uploads) await deps.storage.remove(u.bucket, u.object_key).catch(() => undefined);
      const archives = await tx.selectFrom('data_exports').select('object_key').where('user_id', '=', user.id).where('object_key', 'is not', null).execute();
      for (const a of archives) await deps.storage.remove(deps.exportsBucket, a.object_key!).catch(() => undefined);
      if (user.avatar_key && deps.avatarsBucket) await deps.storage.remove(deps.avatarsBucket, user.avatar_key).catch(() => undefined);
      await tx.deleteFrom('users').where('id', '=', user.id).execute();
    });
    purged++;
  }
  return purged;
}

/** Expired archives leave the bucket; the row stays as the record that one was made. */
export async function purgeExpiredExports(deps: Pick<PrivacyDeps, 'db' | 'storage' | 'exportsBucket'>): Promise<number> {
  const expired = await deps.db.withSystem('privacy: find expired archives', (tx) =>
    tx.selectFrom('data_exports').select(['id', 'object_key']).where('expires_at', '<', sql<Date>`now()`).where('object_key', 'is not', null).limit(500).execute(),
  );
  for (const e of expired) {
    await deps.storage.remove(deps.exportsBucket, e.object_key!).catch(() => undefined);
    await deps.db.withSystem('privacy: forget an expired archive', (tx) => tx.updateTable('data_exports').set({ object_key: null, status: 'failed', error: 'This archive expired. Ask for a new one.' }).where('id', '=', e.id).execute());
  }
  return expired.length;
}
