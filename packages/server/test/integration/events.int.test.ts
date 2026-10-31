import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { productEventsSchema } from '@nextkin/shared/schemas/events';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { purgeEvents, recordEvents } from '../../src/services/events';
import { createUser, deleteUsers } from './fixtures/pipeline';

/**
 * Usage events (owner, 2026-10-31; V2 §8.5). They stay on our server, they can't carry anything a
 * person typed, and someone who opted out records nothing at all.
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];
const as = (userId: string) => ({ userId, role: 'user' as const });
const at = new Date().toISOString();
const client = { platform: 'android', version: '0.1.0' };

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 4 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

const rows = (userId: string) => db.withUser(as(userId), (tx) => tx.selectFrom('product_events').selectAll().where('user_id', '=', userId).execute());

describe('usage events', () => {
  it('keeps a name, a label and the platform', async () => {
    const userId = await createUser(db, users);
    await recordEvents(db, as(userId), [{ name: 'job_added', at, properties: { how: 'link' } }], client);
    expect(await rows(userId)).toMatchObject([{ name: 'job_added', platform: 'android', app_version: '0.1.0', properties: { how: 'link' } }]);
  });

  it('records nothing for someone who opted out', async () => {
    const userId = await createUser(db, users);
    await db.withUser(as(userId), (tx) =>
      tx
        .insertInto('user_settings')
        .values({ user_id: userId, privacy_settings: JSON.stringify({ shareAnonymizedData: false }) })
        .onConflict((oc) => oc.column('user_id').doUpdateSet({ privacy_settings: JSON.stringify({ shareAnonymizedData: false }) }))
        .execute(),
    );
    await recordEvents(db, as(userId), [{ name: 'app_opened', at }], client);
    expect(await rows(userId)).toHaveLength(0);
  });

  it('ignores a client it does not know', async () => {
    const userId = await createUser(db, users);
    await recordEvents(db, as(userId), [{ name: 'app_opened', at }], { platform: 'curl', version: undefined });
    expect(await rows(userId)).toHaveLength(0);
  });

  it('refuses anything a person could have typed', () => {
    const typed = (properties: Record<string, string>) => productEventsSchema.safeParse({ events: [{ name: 'job_added', at, properties }] }).success;
    expect(typed({ how: 'link' })).toBe(true);
    expect(typed({ how: 'Senior Designer at Acme' })).toBe(false);
    expect(typed({ email: 'someone' })).toBe(false);
    expect(productEventsSchema.safeParse({ events: [{ name: 'anything_at_all', at }] }).success).toBe(false);
  });

  it('keeps 13 months', async () => {
    const userId = await createUser(db, users);
    await recordEvents(db, as(userId), [{ name: 'app_opened', at }], client);
    const later = new Date();
    later.setMonth(later.getMonth() + 14);
    await purgeEvents(db, later);
    expect(await rows(userId)).toHaveLength(0);
  });
});
