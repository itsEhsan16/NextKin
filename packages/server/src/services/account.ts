import type { ActivityEntry, ActivityKind } from '@nextkin/shared/models/activity';
import type { NotificationPrefs, NotificationSettings } from '@nextkin/shared/models/notification';
import type { ConnectedAccount } from '@nextkin/shared/models/settings';
import type { AccountSecurity, AccountSession, DashboardStats, User } from '@nextkin/shared/models/user';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@nextkin/shared/models/notification';
import { sql } from 'kysely';
import { hashSessionId } from '../auth/sessions';
import type { Database, Identity } from '../db/database';
import { decodeCursor, encodeCursor } from '../http/cursor';
import { errors } from '../http/errors';
import { notificationPrefs, notificationSettings } from './profileRead';

/**
 * The account (ImBackendImplementationPlan P5-05, P5-06): the user, security and sessions, the
 * dashboard counters and activity feed, and notification preferences. Everything runs under RLS.
 */

/** Signs the avatar's object key for a read (15 minutes at most); absent until uploads exist (P7). */
export type AvatarSigner = (bucket: string, key: string) => Promise<string>;

export async function getUser(db: Database, identity: Identity, signAvatar?: AvatarSigner): Promise<User> {
  const row = await db.withUser(identity, (tx) =>
    tx
      .selectFrom('users as u')
      .leftJoin('uploads as a', (join) => join.onRef('a.object_key', '=', 'u.avatar_key').on('a.status', '=', 'clean'))
      .select(['u.id', 'u.email', 'u.first_name', 'u.last_name', 'u.email_verified', 'u.created_at', 'a.bucket as avatar_bucket', 'a.object_key as avatar_key'])
      .where('u.id', '=', identity.userId)
      .executeTakeFirstOrThrow(),
  );
  // Only a clean upload is ever signed; an avatar whose upload is gone simply reads as none.
  const avatarUrl = signAvatar && row.avatar_bucket && row.avatar_key ? await signAvatar(row.avatar_bucket, row.avatar_key).catch(() => undefined) : undefined;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    emailVerified: row.email_verified,
    createdAt: new Date(row.created_at).toISOString(),
    ...(avatarUrl ? { avatarUrl } : {}),
  };
}

/** Sets the avatar to a clean image upload of the user's own. */
export async function setAvatar(db: Database, identity: Identity, uploadId: string, signAvatar?: AvatarSigner): Promise<User> {
  await db.withUser(identity, async (tx) => {
    const upload = /^[0-9a-f-]{36}$/i.test(uploadId) ? await tx.selectFrom('uploads').select(['purpose', 'status', 'object_key']).where('id', '=', uploadId).executeTakeFirst() : undefined;
    if (!upload) throw errors.notFound('upload');
    if (upload.purpose !== 'avatar') throw errors.validation({ uploadId: 'not an avatar upload' }, 'That upload is not a photo.');
    if (upload.status !== 'clean') throw errors.conflict(upload.status === 'scanning' ? 'The photo is still being checked.' : 'This photo cannot be used.');
    await tx.updateTable('users').set({ avatar_key: upload.object_key }).where('id', '=', identity.userId).execute();
  });
  return getUser(db, identity, signAvatar);
}

export async function updateName(db: Database, identity: Identity, name: { firstName: string; lastName: string }, signAvatar?: AvatarSigner): Promise<User> {
  await db.withUser(identity, (tx) =>
    tx.updateTable('users').set({ first_name: name.firstName.trim(), last_name: name.lastName.trim() }).where('id', '=', identity.userId).execute(),
  );
  return getUser(db, identity, signAvatar);
}

/** Mirrors a confirmed email change from the identity provider into the app's user row. */
export async function setEmail(db: Database, identity: Identity, email: string): Promise<User> {
  await db.withUser(identity, (tx) => tx.updateTable('users').set({ email, email_verified: true }).where('id', '=', identity.userId).execute());
  return getUser(db, identity);
}

/**
 * The account's security card: when the password last changed, two-factor (candidates have none:
 * §7.1 requires MFA of the admin pool only), and the signed-in sessions, current first, then the
 * most recently active.
 */
export async function getSecurity(db: Database, identity: Identity, currentSessionId: string | null): Promise<AccountSecurity> {
  return db.withUser(identity, async (tx) => {
    const user = await tx.selectFrom('users').select('password_changed_at').where('id', '=', identity.userId).executeTakeFirstOrThrow();
    const rows = await tx
      .selectFrom('sessions')
      .select(['id_hash', 'device', 'platform', 'browser', 'location', 'last_seen_at'])
      .where('user_id', '=', identity.userId)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', sql<Date>`now()`)
      .orderBy('last_seen_at', 'desc')
      .limit(50)
      .execute();
    const currentHash = currentSessionId ? hashSessionId(currentSessionId) : null;
    const sessions: AccountSession[] = rows
      .map((row) => ({
        // The hash, shortened: enough to key a row, useless for presenting as a session.
        id: row.id_hash.slice(0, 16),
        device: (row.device ?? 'desktop') as AccountSession['device'],
        platform: row.platform ?? '',
        browser: row.browser ?? '',
        location: row.location ?? '',
        lastActiveAt: new Date(row.last_seen_at).toISOString(),
        current: row.id_hash === currentHash,
      }))
      .sort((a, b) => Number(b.current) - Number(a.current));
    return {
      passwordChangedAt: user.password_changed_at ? new Date(user.password_changed_at).toISOString() : undefined,
      twoFactorEnabled: false,
      sessions,
    };
  });
}

/**
 * C-11 definitions (doc/claims-register.md): resumes = live (not trashed) documents of either kind;
 * activities = every recorded activity entry; saved jobs = saved jobs not yet expired. Counts, so
 * zero is a true value.
 */
export async function getDashboardStats(db: Database, identity: Identity): Promise<DashboardStats> {
  return db.withUser(identity, async (tx) => {
    const count = sql<string>`count(*)`.as('n');
    const [resumes, activity, saved] = await Promise.all([
      tx.selectFrom('resumes').select(count).where('user_id', '=', identity.userId).where('trashed_at', 'is', null).executeTakeFirstOrThrow(),
      tx.selectFrom('activity').select(count).where('user_id', '=', identity.userId).executeTakeFirstOrThrow(),
      tx.selectFrom('saved_jobs').select(count).where('user_id', '=', identity.userId).where('expired_at', 'is', null).executeTakeFirstOrThrow(),
    ]);
    return { resumesCount: Number(resumes.n), activitiesCount: Number(activity.n), savedJobsCount: Number(saved.n) };
  });
}

const ACTIVITY_KINDS: ActivityKind[] = ['generation', 'score', 'export', 'application', 'saved_job', 'profile', 'cover_letter', 'ats_check', 'interview', 'plan'];

/**
 * Newest first, keyset-paginated on (created_at, id). The cursor keeps created_at as Postgres
 * text, with microseconds: a JS Date would truncate to milliseconds and could skip or repeat rows.
 */
export async function listActivity(db: Database, identity: Identity, options: { limit: number; cursor?: string; cursorSecret: string }) {
  const after = options.cursor ? decodeCursor(options.cursor, options.cursorSecret) : null;
  const rows = await db.withUser(identity, (tx) => {
    let query = tx
      .selectFrom('activity')
      .select(['id', 'kind', 'title', 'detail', 'deep_link', 'resume_id', 'job_ref', 'created_at', sql<string>`created_at::text`.as('created_key')])
      .where('user_id', '=', identity.userId);
    if (after) {
      query = query.where(sql<boolean>`(created_at, id) < (${after.k}::timestamptz, ${after.i}::uuid)`);
    }
    return query.orderBy('created_at', 'desc').orderBy('id', 'desc').limit(options.limit + 1).execute();
  });
  const page = rows.slice(0, options.limit);
  const items: ActivityEntry[] = page
    .filter((row) => (ACTIVITY_KINDS as string[]).includes(row.kind))
    .map((row) => ({
      id: row.id,
      kind: row.kind as ActivityKind,
      title: row.title,
      detail: row.detail ?? undefined,
      createdAt: new Date(row.created_at).toISOString(),
      deepLink: row.deep_link ?? undefined,
      resumeId: row.resume_id ?? undefined,
      jobId: row.job_ref ?? undefined,
    }));
  const last = page.at(-1);
  const nextCursor = rows.length > options.limit && last ? encodeCursor({ k: last.created_key, i: last.id }, options.cursorSecret) : undefined;
  return nextCursor ? { items, nextCursor } : { items };
}

// ---------------------------------------------------------------------------------------------
// Notification preferences: stored beside the job preferences, as §17.3's per-user preferences.

async function readPreferences(db: Database, identity: Identity) {
  const row = await db.withUser(identity, (tx) => tx.selectFrom('profiles').select('preferences').where('user_id', '=', identity.userId).executeTakeFirstOrThrow());
  return row.preferences;
}

async function writeNotifications(db: Database, identity: Identity, key: 'prefs' | 'settings', value: unknown) {
  await db.withUser(identity, (tx) =>
    tx
      .updateTable('profiles')
      .set({ preferences: sql`jsonb_set(preferences || jsonb_build_object('notifications', coalesce(preferences->'notifications', '{}'::jsonb)), ${sql.lit(`{notifications,${key}}`)}::text[], ${JSON.stringify(value)}::jsonb)` })
      .where('user_id', '=', identity.userId)
      .execute(),
  );
}

export const notifications = {
  getPrefs: async (db: Database, identity: Identity): Promise<NotificationPrefs> => notificationPrefs(await readPreferences(db, identity)),
  setPrefs: async (db: Database, identity: Identity, prefs: NotificationPrefs): Promise<NotificationPrefs> => {
    await writeNotifications(db, identity, 'prefs', prefs);
    return prefs;
  },
  getSettings: async (db: Database, identity: Identity): Promise<NotificationSettings> => notificationSettings(await readPreferences(db, identity)),
  setSettings: async (db: Database, identity: Identity, settings: NotificationSettings): Promise<NotificationSettings> => {
    await writeNotifications(db, identity, 'settings', settings);
    return settings;
  },
  resetSettings: async (db: Database, identity: Identity): Promise<NotificationSettings> => {
    await writeNotifications(db, identity, 'settings', DEFAULT_NOTIFICATION_SETTINGS);
    return DEFAULT_NOTIFICATION_SETTINGS;
  },
};

/** Google is the one provider the Connected accounts card draws (the model's ConnectedProvider). */
export function connectedAccounts(identities: { provider: string; linkedAt: string }[]): ConnectedAccount[] {
  const google = identities.find((i) => i.provider === 'google');
  return [google ? { provider: 'google', connected: true, connectedAt: google.linkedAt } : { provider: 'google', connected: false }];
}
