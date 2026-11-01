import type { NotificationPrefs, PushDevice } from '@nextkin/shared/models/notification';
import { sql } from 'kysely';

import type { Database, Identity, Tx } from '../db/database';
import { errors } from '../http/errors';
import type { Logger } from '../observability/logger';
import { notificationPrefs } from './profileRead';
import { inQuietHours, isValidTimeZone, nextLocalHour, NUDGE_HOUR, QUIET_TO_HOUR } from '../push/localTime';
import type { PushPort } from '../push/push';

/**
 * Push (owner, 2026-11-01). A phone that said yes registers here, and anything it should hear about
 * waits in `push_messages` until it's due. Results of the candidate's own work go at once, held to
 * morning by quiet hours. Whatever we chose to raise is a nudge: 9am on the phone's clock, one a day,
 * the rest staying in the feed. The worker sends, so the web process never holds SNS access.
 */

const BATCH = 200;
const MAX_ATTEMPTS = 3;
const RETRY_MINUTES = 5;
/** Shorter than a day, so the next 9am always counts as tomorrow's. */
const NUDGE_GAP_HOURS = 20;
export const PUSH_RETENTION_DAYS = 30;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface NewPush {
  title: string;
  body: string;
  url?: string;
  notificationId?: string;
  nudge?: boolean;
  /** Which nudge wins a morning: lower first. */
  rank?: number;
}

/** A device is one person's: a token seen on another account has moved, and leaves that one. */
export async function registerDevice(db: Database, identity: Identity, device: PushDevice): Promise<void> {
  if (!isValidTimeZone(device.timeZone)) throw errors.validation('That time zone isn’t one we know.');
  await db.withSystem('push: a device signed in to another account', (tx) => tx.deleteFrom('push_devices').where('token', '=', device.token).where('user_id', '!=', identity.userId).execute());
  await db.withUser(identity, (tx) =>
    tx
      .insertInto('push_devices')
      .values({ user_id: identity.userId, platform: device.platform, token: device.token, time_zone: device.timeZone })
      .onConflict((oc) => oc.column('token').doUpdateSet({ platform: device.platform, time_zone: device.timeZone }))
      .execute(),
  );
}

export async function removeDevice(db: Database, identity: Identity, token: string): Promise<void> {
  await db.withUser(identity, (tx) => tx.deleteFrom('push_devices').where('token', '=', token).execute());
}

/** Every phone goes quiet: "sign out everywhere" means them too. */
export const removeAllDevices = (tx: Tx, userId: string) => tx.deleteFrom('push_devices').where('user_id', '=', userId).execute();

/** Queues a push on the caller's transaction, as its owner. Nothing registered means nothing to do. */
export async function queuePush(tx: Tx, userId: string, prefs: Pick<NotificationPrefs, 'quietHours'>, push: NewPush, now = new Date()): Promise<void> {
  const device = await tx.selectFrom('push_devices').select('time_zone').where('user_id', '=', userId).orderBy('updated_at', 'desc').executeTakeFirst();
  if (!device) return;
  const zone = device.time_zone;
  const due = push.nudge ? nextLocalHour(now, zone, NUDGE_HOUR) : prefs.quietHours && inQuietHours(now, zone) ? nextLocalHour(now, zone, QUIET_TO_HOUR) : now;
  await tx
    .insertInto('push_messages')
    .values({ user_id: userId, notification_id: push.notificationId ?? null, title: push.title, body: push.body, url: push.url ?? null, kind: push.nudge ? 'nudge' : 'now', rank: push.rank ?? 0, due_at: due })
    .execute();
}

interface DueRow {
  id: string;
  user_id: string;
  notification_id: string | null;
  title: string;
  body: string;
  url: string | null;
  kind: string;
  attempts: number;
  read_at: Date | null;
}

type Outcome = 'sent' | 'read' | 'capped' | 'no_device' | 'off' | 'failed';

export interface PushDeps {
  db: Database;
  push: PushPort | null;
  log: Logger;
}

/**
 * Sends what's due, oldest first, the better nudge first within a morning. Each row is claimed in
 * its own commit before anything leaves, so a run that overlaps the next one can't push twice, and
 * one that dies mid-way loses a push rather than repeating it.
 */
export async function sendDuePushes(deps: PushDeps, now = new Date()): Promise<number> {
  const { db, push, log } = deps;
  const rows = await db.withSystem('push: claim messages due', async (tx) => {
    const due = await tx
      .selectFrom('push_messages as m')
      .leftJoin('notifications as n', 'n.id', 'm.notification_id')
      .select(['m.id', 'm.user_id', 'm.notification_id', 'm.title', 'm.body', 'm.url', 'm.kind', 'm.attempts', 'n.read_at'])
      .where('m.sent_at', 'is', null)
      .where('m.due_at', '<=', now)
      .orderBy('m.due_at')
      .orderBy('m.rank')
      .limit(BATCH)
      .forUpdate('m')
      .skipLocked()
      .execute();
    if (due.length) await tx.updateTable('push_messages').set({ sent_at: now }).where('id', 'in', due.map((row) => row.id)).execute();
    return due as DueRow[];
  });

  let sent = 0;
  for (const row of rows) {
    const finish = (outcome: Outcome) => db.withSystem('push: record what became of a message', (tx) => tx.updateTable('push_messages').set({ outcome }).where('id', '=', row.id).execute());
    if (!push) await finish('off');
    else if (row.read_at) await finish('read');
    else if (row.kind === 'nudge' && (await nudgedLately(db, row.user_id, now))) await finish('capped');
    else {
      try {
        const reached = await deliver(deps, push, row);
        await finish(reached ? 'sent' : 'no_device');
        if (reached) sent++;
      } catch (error) {
        const attempts = row.attempts + 1;
        log.warn({ event: 'push.failed', attempts, errorName: error instanceof Error ? error.name : typeof error }, 'a push did not leave');
        await db.withSystem('push: put a message back to try again', (tx) =>
          tx
            .updateTable('push_messages')
            .set(attempts < MAX_ATTEMPTS ? { attempts, sent_at: null, due_at: new Date(now.getTime() + RETRY_MINUTES * 60_000) } : { attempts, outcome: 'failed' })
            .where('id', '=', row.id)
            .execute(),
        );
      }
    }
  }
  return sent;
}

async function nudgedLately(db: Database, userId: string, now: Date): Promise<boolean> {
  const since = new Date(now.getTime() - NUDGE_GAP_HOURS * HOUR_MS);
  const recent = await db.withSystem('push: nudges this person had lately', (tx) =>
    tx.selectFrom('push_messages').select('id').where('user_id', '=', userId).where('kind', '=', 'nudge').where('outcome', '=', 'sent').where('sent_at', '>', since).executeTakeFirst(),
  );
  return recent !== undefined;
}

/** True when at least one phone took it. A device the provider has lost is forgotten here too. */
async function deliver({ db }: PushDeps, push: PushPort, row: DueRow): Promise<boolean> {
  const devices = await db.withSystem('push: the devices a message goes to', (tx) => tx.selectFrom('push_devices').select(['id', 'platform', 'token', 'endpoint_arn']).where('user_id', '=', row.user_id).execute());
  let reached = false;
  for (const device of devices) {
    let endpoint = device.endpoint_arn;
    if (!endpoint) {
      endpoint = await push.endpointFor({ platform: device.platform as 'android' | 'ios', token: device.token });
      const arn = endpoint;
      await db.withSystem('push: keep a device’s address', (tx) => tx.updateTable('push_devices').set({ endpoint_arn: arn }).where('id', '=', device.id).execute());
    }
    const result = await push.send(endpoint, { title: row.title, body: row.body, ...(row.url ? { url: row.url } : {}), ...(row.notification_id ? { notificationId: row.notification_id } : {}) });
    if (result === 'sent') {
      reached = true;
      continue;
    }
    await db.withSystem('push: forget a device that has left', (tx) => tx.deleteFrom('push_devices').where('id', '=', device.id).execute());
    await push.forget(endpoint);
  }
  return reached;
}

const DIGEST_RANK = 4;
const SUNDAY = 0;

/**
 * "Anything you missed, Sunday 9am" (NOTIF 04). The daily job does nothing until Sunday in UTC, and
 * the 9am rule puts each digest on the phone's own Sunday morning. A push of its own: a row in the
 * feed saying the feed has rows would only be one more to read.
 */
export async function runWeeklyDigest(db: Database, now = new Date()): Promise<number> {
  if (now.getUTCDay() !== SUNDAY) return 0;
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const waiting = await db.withSystem('push: who has unread notifications this week', (tx) =>
    tx
      .selectFrom('notifications as n')
      .innerJoin('push_devices as d', 'd.user_id', 'n.user_id')
      .innerJoin('profiles as p', 'p.user_id', 'n.user_id')
      .select(['n.user_id', 'p.preferences', sql<string>`count(distinct n.id)`.as('unread')])
      .where('n.read_at', 'is', null)
      .where('n.created_at', '>=', since)
      .groupBy(['n.user_id', 'p.preferences'])
      .execute(),
  );
  let queued = 0;
  for (const row of waiting) {
    const prefs = notificationPrefs(row.preferences);
    if (!prefs.weeklyDigest) continue;
    const count = Number(row.unread);
    await db.withUser({ userId: row.user_id, role: 'user' }, (tx) =>
      queuePush(tx, row.user_id, prefs, { title: count === 1 ? 'One thing you missed this week' : `${count} things you missed this week`, body: 'Open NextKin to catch up.', url: '/notifications', nudge: true, rank: DIGEST_RANK }, now),
    );
    queued++;
  }
  return queued;
}

export async function purgePushMessages(db: Database, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PUSH_RETENTION_DAYS * DAY_MS);
  const result = await db.withSystem('maintenance: delete push messages past retention', (tx) => tx.deleteFrom('push_messages').where('created_at', '<', cutoff).executeTakeFirst());
  return Number(result.numDeletedRows);
}
