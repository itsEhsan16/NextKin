import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { getSubscription } from '../../src/services/billing';
import * as generations from '../../src/services/generations';
import { capturingPublisher, createUser, deleteUsers } from './fixtures/pipeline';

/**
 * Quotas (ImBackendImplementationPlan P12-09; V2 §13.3, G2): two concurrent runs cannot race a
 * counter past its cap, a failed or cancelled run costs nothing, a Zero Resume draft spends a
 * generation too, Free's interview set is one per resume, and the meters show their reset dates.
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 8 });
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

const start = (userId: string, input: Record<string, unknown>) => generations.startGeneration(db, { userId, role: 'user' }, { kind: 'resume', ...input } as never, { idempotencyKey: randomUUID(), correlationId: null });

async function spend(userId: string, metric: string, used: number) {
  await db.withUser({ userId, role: 'user' }, (tx) =>
    tx
      .insertInto('usage_counters')
      .values({ user_id: userId, metric, period_start: sql<Date>`date_trunc('month', now() at time zone 'utc')::date`, period_end: sql<Date>`(date_trunc('month', now() at time zone 'utc') + interval '1 month')::date`, used })
      .execute(),
  );
}

const meter = (userId: string, metric: string) =>
  db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('usage_counters').select(['used', 'reserved']).where('metric', '=', metric).executeTakeFirst());

describe('quotas (P12-09)', () => {
  it('two concurrent runs at the last slot: one starts, the other is refused before any work', async () => {
    const userId = await createUser(db, users);
    await spend(userId, 'generation', 2);
    const results = await Promise.allSettled([start(userId, {}), start(userId, {})]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const refused = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(refused.reason).toMatchObject({ code: 'PLAN_LOCKED', details: { reason: 'generation', limit: 3 } });
    expect(String(refused.reason.details.resetsAt)).toMatch(/-01T00:00:00/);
    expect(await meter(userId, 'generation')).toEqual({ used: 2, reserved: 1 });
  });

  it('a cancelled run costs nothing and frees its slot', async () => {
    const userId = await createUser(db, users);
    await spend(userId, 'generation', 2);
    const { generation } = await start(userId, {});
    await expect(start(userId, {})).rejects.toMatchObject({ code: 'PLAN_LOCKED' });
    await generations.cancelGeneration(db, { userId, role: 'user' }, capturingPublisher(), generation.id);
    expect(await meter(userId, 'generation')).toEqual({ used: 2, reserved: 0 });
    await expect(start(userId, {})).resolves.toBeTruthy();
  });

  it('a Zero Resume draft spends a generation and the monthly draft', async () => {
    const userId = await createUser(db, users);
    await start(userId, { kind: 'zero_resume', zero: { yearsExperience: 3 } });
    expect(await meter(userId, 'generation')).toEqual({ used: 0, reserved: 1 });
    expect(await meter(userId, 'zero_resume')).toEqual({ used: 0, reserved: 1 });
    await expect(start(userId, { kind: 'zero_resume', zero: { yearsExperience: 3 } })).rejects.toMatchObject({ code: 'PLAN_LOCKED', details: { reason: 'zero_resume' } });
  });

  it('Free gets one interview set per resume; two starts at once cannot both pass', async () => {
    const userId = await createUser(db, users);
    const resume = await db.withUser({ userId, role: 'user' }, (tx) => tx.insertInto('resumes').values({ user_id: userId, title: 'Quota resume', doc_type: 'resume', source: 'manual' }).returning('id').executeTakeFirstOrThrow());
    const results = await Promise.allSettled([start(userId, { kind: 'interview', sourceResumeId: resume.id }), start(userId, { kind: 'interview', sourceResumeId: resume.id })]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ code: 'PLAN_LOCKED', details: { reason: 'interview_set_per_resume' } });
  });

  it('Pro has no per-resume interview cap, and the meters carry their reset dates', async () => {
    const userId = await createUser(db, users, 'pro');
    const resume = await db.withUser({ userId, role: 'user' }, (tx) => tx.insertInto('resumes').values({ user_id: userId, title: 'Pro resume', doc_type: 'resume', source: 'manual' }).returning('id').executeTakeFirstOrThrow());
    await start(userId, { kind: 'interview', sourceResumeId: resume.id });
    await start(userId, { kind: 'interview', sourceResumeId: resume.id });
    const sub = await getSubscription(db, { userId, role: 'user' });
    expect(sub).toMatchObject({ plan: 'pro', usage: { generationsLimit: 100 } });
    expect(sub.usage.resetsAt).toMatch(/-01T00:00:00/);
    expect(sub.usage.assistantResetsAt).toMatch(/T00:00:00/);
  });
});
