import { createHash, randomBytes } from 'node:crypto';
import type Valkey from 'iovalkey';
import { sql } from 'kysely';
import type { Database, UserRole } from '../db/database';
import type { ClientKind } from './ports/identity';

/**
 * Server-side sessions (ImBackendImplementationPlan P4-04, spec §7.1). The live session is a
 * Valkey record (`sess:<id>`, plus a `user-sessions:<user_id>` set); a durable row in
 * app.sessions backs the "active sessions" list. Every authenticated request checks the record,
 * so deleting it is an immediate logout — for a web cookie and for a mobile bearer token alike,
 * because the token's `sid` names the same record.
 *
 * Web: an opaque 256-bit id in a `__Host-` cookie. Mobile: the identity provider's sessionRef.
 * Only a SHA-256 of the id is ever stored in Postgres.
 */

export const SESSION_COOKIE = '__Host-nk_session';
const ABSOLUTE_SECONDS = 30 * 24 * 60 * 60; // spec §9.4.1: the 30-day absolute lifetime
const TOUCH_EVERY_MS = 5 * 60 * 1000;

export interface SessionRecord {
  userId: string;
  role: UserRole;
  /** §7.17: Super Admin (role assignment, provider keys) is an application permission on an admin. */
  superAdmin?: boolean;
  sub: string;
  pool: 'users' | 'admins';
  client: ClientKind;
  /** The identity provider's session, revoked on logout. */
  sessionRef: string;
  createdAt: number;
  expiresAt: number;
  lastSeenAt: number;
}

export interface SessionMeta {
  device?: 'desktop' | 'phone' | 'tablet';
  platform?: string;
  browser?: string;
}

const key = (id: string) => `sess:${id}`;
const setKey = (userId: string) => `user-sessions:${userId}`;
export const hashSessionId = (id: string) => createHash('sha256').update(id).digest('hex');
export const newSessionId = () => randomBytes(32).toString('base64url');

export interface SessionStore {
  create(id: string, record: Omit<SessionRecord, 'createdAt' | 'expiresAt' | 'lastSeenAt'>, meta?: SessionMeta): Promise<SessionRecord>;
  get(id: string): Promise<SessionRecord | null>;
  destroy(id: string): Promise<SessionRecord | null>;
  /** Ends every session of the user but `exceptId`; returns the records it ended. */
  destroyAllForUser(userId: string, exceptId?: string): Promise<SessionRecord[]>;
}

export function createSessionStore(valkey: Valkey, db: Database): SessionStore {
  async function markRevoked(userId: string, ids: string[]) {
    if (!ids.length) return;
    await db.withUser({ userId, role: 'user' }, (tx) =>
      tx.updateTable('sessions').set({ revoked_at: sql`now()` }).where('id_hash', 'in', ids.map(hashSessionId)).where('revoked_at', 'is', null).execute(),
    );
  }

  return {
    async create(id, base, meta = {}) {
      const now = Date.now();
      const record: SessionRecord = { ...base, createdAt: now, expiresAt: now + ABSOLUTE_SECONDS * 1000, lastSeenAt: now };
      await valkey.set(key(id), JSON.stringify(record), 'EX', ABSOLUTE_SECONDS);
      await valkey.sadd(setKey(base.userId), id);
      await valkey.expire(setKey(base.userId), ABSOLUTE_SECONDS);
      await db.withUser({ userId: base.userId, role: base.role }, (tx) =>
        tx
          .insertInto('sessions')
          .values({
            id_hash: hashSessionId(id),
            user_id: base.userId,
            client: base.client === 'web' ? 'web' : /iphone|ipad|ios/i.test(meta.platform ?? '') ? 'ios' : 'android',
            device: meta.device ?? null,
            platform: meta.platform?.slice(0, 60) ?? null,
            browser: meta.browser?.slice(0, 60) ?? null,
            expires_at: new Date(record.expiresAt),
          })
          .onConflict((oc) => oc.column('id_hash').doNothing())
          .execute(),
      );
      return record;
    },

    async get(id) {
      const raw = await valkey.get(key(id));
      if (!raw) return null;
      const record = JSON.parse(raw) as SessionRecord;
      if (record.expiresAt < Date.now()) return null;
      if (Date.now() - record.lastSeenAt > TOUCH_EVERY_MS) {
        // Throttled: "last active" in the sessions list, without a write per request.
        record.lastSeenAt = Date.now();
        await valkey.set(key(id), JSON.stringify(record), 'KEEPTTL');
        await db
          .withUser({ userId: record.userId, role: record.role }, (tx) =>
            tx.updateTable('sessions').set({ last_seen_at: sql`now()` }).where('id_hash', '=', hashSessionId(id)).execute(),
          )
          .catch(() => {});
      }
      return record;
    },

    async destroy(id) {
      const raw = await valkey.getdel(key(id));
      if (!raw) return null;
      const record = JSON.parse(raw) as SessionRecord;
      await valkey.srem(setKey(record.userId), id);
      await markRevoked(record.userId, [id]);
      return record;
    },

    async destroyAllForUser(userId, exceptId) {
      const ids = (await valkey.smembers(setKey(userId))).filter((id) => id !== exceptId);
      const ended: SessionRecord[] = [];
      // One key per command: safe on clustered ElastiCache (no cross-slot multi-key operations).
      for (const id of ids) {
        const raw = await valkey.getdel(key(id));
        await valkey.srem(setKey(userId), id);
        if (raw) ended.push(JSON.parse(raw) as SessionRecord);
      }
      await markRevoked(userId, ids);
      return ended;
    },
  };
}

export function sessionCookie(id: string): string {
  return `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ABSOLUTE_SECONDS}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readSessionCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=') || null;
  }
  return null;
}
