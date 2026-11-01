import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { weekFourRetention } from '../../src/services/admin/retention';
import { deleteUsers, createUser } from './fixtures/pipeline';

/**
 * Week-4 retention (V2 §2.2). The dates here are far enough from any other suite's that this is the
 * only cohort in its week: signups land on one known Monday, and `now` is set after it.
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];

const MONDAY = new Date('2024-03-04T09:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const after = (days: number, from = MONDAY) => new Date(from.getTime() + days * DAY);
/** Inside the 16 weeks the report looks back over, with the cohort's fourth week over. */
const NOW = after(40);

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 6 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

const signUp = async () => {
  const userId = await createUser(db, users);
  await db.withSystem('test: backdate a signup', (tx) => tx.updateTable('users').set({ created_at: MONDAY }).where('id', '=', userId).execute());
  return userId;
};

async function generation(userId: string, kind: string, status: string, finishedAt: Date) {
  await db.withUser({ userId, role: 'user' }, (tx) =>
    tx.insertInto('generations').values({ user_id: userId, kind, status, idempotency_key: randomUUID(), created_at: finishedAt, finished_at: finishedAt }).execute(),
  );
}

const cohort = async () => (await weekFourRetention(db, NOW)).find((row) => row.week === '2024-03-04');

describe('week-4 retention', () => {
  it('counts who activated within 72 hours, and who came back in their fourth week', async () => {
    const stayed = await signUp();
    await generation(stayed, 'resume', 'ready', after(1));
    await generation(stayed, 'ats_check', 'ready', after(23));

    const left = await signUp();
    await generation(left, 'resume', 'ready', after(1));
    await generation(left, 'resume', 'ready', after(10));

    const late = await signUp();
    await generation(late, 'resume', 'ready', after(5));
    await generation(late, 'resume', 'ready', after(26));

    const failed = await signUp();
    await generation(failed, 'resume', 'failed', after(1));

    expect(await cohort()).toEqual({ week: '2024-03-04', activated: 2, returned: 1, rate: 0.5, complete: true });
  });

  it('calls a week that hasn’t had its fourth week yet unfinished', async () => {
    const early = (await weekFourRetention(db, after(20))).find((row) => row.week === '2024-03-04');
    expect(early?.complete).toBe(false);
  });
});
