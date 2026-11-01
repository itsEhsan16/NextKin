import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { createMemoryPush } from '../../src/push/push';
import * as account from '../../src/services/account';
import * as notifications from '../../src/services/notifications';
import * as push from '../../src/services/push';
import { backendUser } from './fixtures/documents';
import { deleteUsers, log } from './fixtures/pipeline';

/**
 * Push (owner, 2026-11-01). A phone that said yes hears about what happened: a result at once, held
 * to morning by quiet hours, and anything we chose to raise at 9am on its own clock, one a day. A
 * category switched off keeps the row in the feed and off the lock screen. The real SNS can't run
 * here: this drives the sending job against the memory adapter, and `push.test.ts` checks the SNS
 * adapter's calls.
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];
const as = (userId: string) => ({ userId, role: 'user' as const });
const MINUTE = 60_000;

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 6 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

let port: ReturnType<typeof createMemoryPush>;
const send = (at = new Date()) => push.sendDuePushes({ db, push: port, log }, at);
beforeEach(async () => {
  // Rows other suites left due would otherwise be sent here, and counted.
  await db.withSystem('test: clear waiting pushes', (tx) => tx.deleteFrom('push_messages').execute());
  port = createMemoryPush();
});

const phone = async (timeZone = 'UTC') => {
  const userId = await backendUser(db, users);
  const token = randomUUID();
  await push.registerDevice(db, as(userId), { platform: 'android', token, timeZone });
  return { userId, token };
};

const file = (userId: string, category: 'ai' | 'applications' | 'closing', dedupeKey: string, pushRank?: number) =>
  db.withUser(as(userId), (tx) =>
    notifications.notify(tx, userId, { category, body: `**${dedupeKey}** done`, description: 'Open it.', deepLink: '/jobs', visual: { kind: 'sparkle' }, dedupeKey, ...(pushRank === undefined ? {} : { pushRank }) }),
  );

const waiting = (userId: string) => db.withSystem('test: read a person’s pushes', (tx) => tx.selectFrom('push_messages').selectAll().where('user_id', '=', userId).orderBy('created_at').execute());

const withoutQuietHours = async (userId: string) => {
  const prefs = await account.notifications.getPrefs(db, as(userId));
  await account.notifications.setPrefs(db, as(userId), { ...prefs, quietHours: false });
};

describe('sending', () => {
  it('sends a result in the row’s words, with where a tap goes', async () => {
    const { userId, token } = await phone();
    await withoutQuietHours(userId);
    await file(userId, 'ai', 'resume');
    expect(await send(new Date(Date.now() + MINUTE))).toBe(1);
    const [row] = await notifications.listNotifications(db, as(userId));
    expect(port.sent).toEqual([{ endpoint: `memory:android:${token}`, message: { title: 'resume done', body: 'Open it.', url: '/jobs', notificationId: row!.id } }]);
    expect(await send(new Date(Date.now() + 2 * MINUTE))).toBe(0);
    expect((await waiting(userId))[0]).toMatchObject({ outcome: 'sent' });
  });

  it('keeps a device’s address, and asks for it once', async () => {
    const { userId } = await phone();
    await withoutQuietHours(userId);
    await file(userId, 'ai', 'one');
    await send(new Date(Date.now() + MINUTE));
    const before = await db.withUser(as(userId), (tx) => tx.selectFrom('push_devices').select('endpoint_arn').executeTakeFirstOrThrow());
    expect(before.endpoint_arn).toContain('memory:android');
  });

  it('queues nothing for someone with no phone registered, and still fills the feed', async () => {
    const userId = await backendUser(db, users);
    await file(userId, 'ai', 'quiet');
    expect(await waiting(userId)).toHaveLength(0);
    expect(await notifications.listNotifications(db, as(userId))).toHaveLength(1);
  });

  it('keeps a switched-off category in the feed and off the lock screen', async () => {
    const { userId } = await phone();
    const prefs = await account.notifications.getPrefs(db, as(userId));
    await account.notifications.setPrefs(db, as(userId), { ...prefs, categories: { ...prefs.categories, ai: false } });
    await file(userId, 'ai', 'muted');
    expect(await waiting(userId)).toHaveLength(0);
    expect(await notifications.listNotifications(db, as(userId))).toHaveLength(1);
  });

  it('drops a push for a row that was read or removed before it left', async () => {
    const { userId } = await phone();
    await withoutQuietHours(userId);
    await file(userId, 'ai', 'read-first');
    await file(userId, 'ai', 'removed-first');
    const [newest, oldest] = await notifications.listNotifications(db, as(userId));
    await notifications.markRead(db, as(userId), oldest!.id);
    await notifications.removeNotification(db, as(userId), newest!.id);
    expect(await send(new Date(Date.now() + MINUTE))).toBe(0);
    expect(port.sent).toHaveLength(0);
    expect((await waiting(userId)).map((row) => row.outcome)).toEqual(['read']);
  });

  it('forgets a device the provider has lost', async () => {
    const { userId, token } = await phone();
    await withoutQuietHours(userId);
    const endpoint = `memory:android:${token}`;
    port.gone.add(endpoint);
    await file(userId, 'ai', 'gone');
    await send(new Date(Date.now() + MINUTE));
    expect(port.forgotten).toEqual([endpoint]);
    const devices = await db.withUser(as(userId), (tx) => tx.selectFrom('push_devices').select('id').execute());
    expect(devices).toHaveLength(0);
    expect((await waiting(userId))[0]).toMatchObject({ outcome: 'no_device' });
  });

  it('tries a failed send again, and gives up after three', async () => {
    const { userId } = await phone();
    await withoutQuietHours(userId);
    await file(userId, 'ai', 'failing');
    const failing = { ...port, send: async () => { throw new Error('throttled'); } };
    let at = new Date(Date.now() + MINUTE);
    for (let attempt = 0; attempt < 3; attempt++) {
      await push.sendDuePushes({ db, push: failing, log }, at);
      at = new Date(at.getTime() + 6 * MINUTE);
    }
    expect((await waiting(userId))[0]).toMatchObject({ outcome: 'failed', attempts: 3 });
  });

  it('closes what’s due where push is off', async () => {
    const { userId } = await phone();
    await withoutQuietHours(userId);
    await file(userId, 'ai', 'off');
    await push.sendDuePushes({ db, push: null, log }, new Date(Date.now() + MINUTE));
    expect((await waiting(userId))[0]).toMatchObject({ outcome: 'off' });
  });
});

describe('timing', () => {
  it('holds a result through quiet hours until 8am', async () => {
    const { userId } = await phone('Asia/Kolkata');
    await db.withUser(as(userId), (tx) => push.queuePush(tx, userId, { quietHours: true }, { title: 'late', body: '' }, new Date('2026-11-01T18:00:00Z')));
    const [row] = await waiting(userId);
    expect(row!.due_at.toISOString()).toBe('2026-11-02T02:30:00.000Z');
  });

  it('sends a result in quiet hours to someone who turned them off', async () => {
    const { userId } = await phone('Asia/Kolkata');
    const at = new Date('2026-11-01T18:00:00Z');
    await db.withUser(as(userId), (tx) => push.queuePush(tx, userId, { quietHours: false }, { title: 'late', body: '' }, at));
    expect((await waiting(userId))[0]!.due_at.toISOString()).toBe(at.toISOString());
  });

  it('puts a nudge at 9am on the phone’s clock', async () => {
    const { userId } = await phone('Asia/Kolkata');
    await db.withUser(as(userId), (tx) => push.queuePush(tx, userId, { quietHours: true }, { title: 'news', body: '', nudge: true }, new Date('2026-11-01T00:00:00Z')));
    expect((await waiting(userId))[0]).toMatchObject({ kind: 'nudge' });
    expect((await waiting(userId))[0]!.due_at.toISOString()).toBe('2026-11-01T03:30:00.000Z');
  });

  it('sends one nudge a day, the best first, and leaves the rest in the feed', async () => {
    const { userId } = await phone();
    await file(userId, 'applications', 'follow-up', 2);
    await file(userId, 'applications', 'interview', 0);
    const tomorrow = new Date(Date.now() + 25 * 60 * MINUTE);
    expect(await send(tomorrow)).toBe(1);
    expect(port.sent[0]?.message.title).toBe('interview done');
    expect((await waiting(userId)).map((row) => row.outcome).sort()).toEqual(['capped', 'sent']);
    expect(await notifications.listNotifications(db, as(userId))).toHaveLength(2);

    await file(userId, 'closing', 'next-day', 1);
    expect(await send(new Date(tomorrow.getTime() + 21 * 60 * MINUTE + 24 * 60 * MINUTE))).toBe(1);
  });

  it('doesn’t count a result against the day’s nudge', async () => {
    const { userId } = await phone();
    await withoutQuietHours(userId);
    await file(userId, 'ai', 'result');
    await file(userId, 'applications', 'nudge');
    expect(await send(new Date(Date.now() + 25 * 60 * MINUTE))).toBe(2);
  });
});

describe('a device', () => {
  it('moves with the account that signs in on it', async () => {
    const { userId, token } = await phone();
    const next = await backendUser(db, users);
    await push.registerDevice(db, as(next), { platform: 'android', token, timeZone: 'Europe/Berlin' });
    const devices = (id: string) => db.withUser(as(id), (tx) => tx.selectFrom('push_devices').select('time_zone').execute());
    expect(await devices(userId)).toHaveLength(0);
    expect(await devices(next)).toEqual([{ time_zone: 'Europe/Berlin' }]);
  });

  it('can register twice, leave, and be refused a time zone that isn’t one', async () => {
    const { userId, token } = await phone();
    await push.registerDevice(db, as(userId), { platform: 'android', token, timeZone: 'Asia/Tokyo' });
    await expect(push.registerDevice(db, as(userId), { platform: 'android', token, timeZone: 'Mars/Olympus' })).rejects.toThrow();
    await push.removeDevice(db, as(userId), token);
    expect(await db.withUser(as(userId), (tx) => tx.selectFrom('push_devices').select('id').execute())).toHaveLength(0);
  });
});

describe('the weekly digest', () => {
  const sunday = new Date('2026-11-08T00:00:00Z');
  const fileOn = async (userId: string) => {
    await file(userId, 'ai', `unread-${randomUUID()}`);
    await db.withSystem('test: backdate a row', (tx) => tx.updateTable('notifications').set({ created_at: new Date(sunday.getTime() - 60 * 60 * 1000) }).where('user_id', '=', userId).execute());
  };

  it('counts what they missed, on Sunday morning only, for those who want it', async () => {
    const { userId } = await phone();
    await fileOn(userId);
    await fileOn(userId);
    await db.withSystem('test: clear the results', (tx) => tx.deleteFrom('push_messages').where('user_id', '=', userId).execute());

    const unwilling = await phone();
    await fileOn(unwilling.userId);
    const prefs = await account.notifications.getPrefs(db, as(unwilling.userId));
    await account.notifications.setPrefs(db, as(unwilling.userId), { ...prefs, weeklyDigest: false });
    await db.withSystem('test: clear the results', (tx) => tx.deleteFrom('push_messages').where('user_id', '=', unwilling.userId).execute());

    expect(await push.runWeeklyDigest(db, new Date('2026-11-07T00:00:00Z'))).toBe(0);
    await push.runWeeklyDigest(db, sunday);
    expect((await waiting(userId))[0]).toMatchObject({ title: '2 things you missed this week', url: '/notifications', kind: 'nudge' });
    expect(await waiting(unwilling.userId)).toHaveLength(0);
  });
});
