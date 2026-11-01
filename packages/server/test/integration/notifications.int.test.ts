import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { fixtureHashOf } from '../../src/jobs/ids';
import { createFixtureProvider } from '../../src/jobs/providers/fixture';
import { snapshotOf } from '../../src/jobs/toJob';
import { failGeneration, FAILURE_MESSAGE } from '../../src/pipeline/runner';
import * as account from '../../src/services/account';
import { startGeneration } from '../../src/services/generations';
import * as notifications from '../../src/services/notifications';
import { backendUser, readyJd, runToEnd } from './fixtures/documents';
import { deleteUsers, key, log } from './fixtures/pipeline';

/**
 * The notification feed (owner, 2026-10-31; changes D-05). It holds what really happened: runs,
 * saved jobs closing, billing. A retried job never says a thing twice, a category switched off
 * only keeps it off the lock screen, and nobody reads another account's rows.
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];
const as = (userId: string) => ({ userId, role: 'user' as const });

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 6 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

const file = (userId: string, dedupeKey: string) =>
  db.withUser(as(userId), (tx) =>
    notifications.notify(tx, userId, { category: 'ai', body: 'Done', description: '', visual: { kind: 'sparkle' }, dedupeKey }),
  );

const feed = (userId: string) => notifications.listNotifications(db, as(userId));

describe('the feed', () => {
  it('tells of a finished run, once, linked to the run', async () => {
    const userId = await backendUser(db, users);
    const jd = await readyJd(db, userId, groundedModel);
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id }, groundedModel);
    const [row] = await feed(userId);
    expect(row).toMatchObject({ category: 'ai', read: false, deepLink: `/generations/${run.generationId}` });
    expect(row!.body).toContain('is ready');
    expect(await feed(userId)).toHaveLength(1);
  });

  it('tells of a failed run, and keeps quiet about one the candidate stopped', async () => {
    const userId = await backendUser(db, users);
    const fail = async (code: string, message: string) => {
      const { generation } = await startGeneration(db, as(userId), { kind: 'resume' }, { idempotencyKey: key(), correlationId: null });
      await db.withUser(as(userId), async (tx) => {
        const row = await tx.selectFrom('generations').selectAll().where('id', '=', generation.id).executeTakeFirstOrThrow();
        await failGeneration(tx, row as never, code, message, 1);
      });
      return generation.id;
    };
    await fail('cancelled', FAILURE_MESSAGE.cancelled);
    expect(await feed(userId)).toHaveLength(0);
    const id = await fail('timed_out', FAILURE_MESSAGE.timed_out);
    const [row] = await feed(userId);
    expect(row!.body).toContain('didn’t finish');
    expect(row!.deepLink).toBe(`/generations/${id}`);
  });

  it('never says the same thing twice', async () => {
    const userId = await backendUser(db, users);
    await file(userId, 'billing:paid:1');
    await file(userId, 'billing:paid:1');
    expect(await feed(userId)).toHaveLength(1);
  });

  it('keeps a category switched off in the feed: the switches choose what reaches the lock screen', async () => {
    const userId = await backendUser(db, users);
    const prefs = await account.notifications.getPrefs(db, as(userId));
    await account.notifications.setPrefs(db, as(userId), { ...prefs, categories: { ...prefs.categories, ai: false, billing: false } });
    await file(userId, 'muted');
    expect(await feed(userId)).toHaveLength(1);
    await db.withUser(as(userId), (tx) => notifications.notifyBilling(tx, userId, 'failed', 'failed:sub:today'));
    const [row] = await feed(userId);
    expect(row).toMatchObject({ category: 'billing', deepLink: '/upgrade' });
  });

  it('marks one read, marks all read and removes one, for its owner only', async () => {
    const owner = await backendUser(db, users);
    const other = await backendUser(db, users);
    await file(owner, 'one');
    await file(owner, 'two');
    const [first, second] = await feed(owner);
    await expect(notifications.markRead(db, as(other), first!.id)).rejects.toThrow();
    await expect(notifications.removeNotification(db, as(other), first!.id)).rejects.toThrow();
    expect(await feed(other)).toHaveLength(0);

    expect((await notifications.markRead(db, as(owner), first!.id)).read).toBe(true);
    await notifications.markAllRead(db, as(owner));
    expect((await feed(owner)).every((n) => n.read)).toBe(true);
    await notifications.removeNotification(db, as(owner), second!.id);
    expect(await feed(owner)).toHaveLength(1);
  });

  it('warns once about a saved job closing within 48 hours, and not about one further off', async () => {
    const userId = await backendUser(db, users);
    const now = new Date();
    const [listing] = await createFixtureProvider().search({ page: 1 });
    const save = async (key: string, hours: number) => {
      const hash = fixtureHashOf(`closing-${key}-${userId}`);
      const snapshot = { ...snapshotOf(listing!), applyUrlHash: hash, closingAt: new Date(now.getTime() + hours * 3600_000).toISOString() };
      await db.withUser(as(userId), (tx) => tx.insertInto('saved_jobs').values({ user_id: userId, apply_url_hash: hash, snapshot: JSON.stringify(snapshot) }).execute());
    };
    await save('soon', 20);
    await save('later', 96);
    await notifications.runClosingAlerts(db, log, now);
    await notifications.runClosingAlerts(db, log, now);
    const rows = await feed(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: 'closing' });
    expect(rows[0]!.body).toContain('closes tomorrow');
  });

  it('keeps 90 days', async () => {
    const userId = await backendUser(db, users);
    await file(userId, 'old');
    await notifications.purgeNotifications(db, new Date(Date.now() + 91 * 24 * 3600_000));
    expect(await feed(userId)).toHaveLength(0);
  });
});
