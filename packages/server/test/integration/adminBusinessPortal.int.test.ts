import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { countProviderCall } from '../../src/jobs/providerCalls';
import * as business from '../../src/services/admin/business';
import { analyticsReport } from '../../src/services/admin/businessAnalytics';
import { overview } from '../../src/services/admin/overview';
import type { Staff } from '../../src/services/admin/permissions';
import * as users from '../../src/services/admin/users';
import { startHarness, type Harness } from './fixtures/authHarness';

/**
 * The admin portal's Business area and Overview against Postgres (toreview §171.13): the Overview's
 * rates read their cohorts from real rows, the price book versions both Pro plans at once, comps
 * list and end with their audit rows, and provider calls are counted per day. The shared database
 * has other rows in it, so each check compares before and after its own rows.
 */
let h: Harness;
const meta = { ip: '127.0.0.1', requestId: 'req-business-test' };
const DOMAIN = 'nkb.test';
const PROVIDER = `zz-test-${randomUUID().slice(0, 6)}`;

beforeAll(async () => {
  h = await startHarness({});
});
afterAll(async () => {
  await h.db.withUser({ userId: randomUUID(), role: 'admin' }, (tx) => tx.deleteFrom('job_provider_calls').where('provider', '=', PROVIDER).execute());
  await h.db.withSystem('test: tidy business rows', (tx) => tx.deleteFrom('users').where('email', 'like', `%@${DOMAIN}`).execute());
  await h.close();
});

async function staffMember(level: Staff['level']): Promise<Staff> {
  const userId = randomUUID();
  const role = level === 'super_admin' ? 'admin' : level;
  await h.db.withUser({ userId, role: 'user' }, (tx) => tx.insertInto('users').values({ id: userId, identity_sub: `local|staff-${userId}`, email: `staff-${userId.slice(0, 8)}@${DOMAIN}`, first_name: 'Bea', last_name: 'Business', role }).execute());
  return { identity: { userId, role }, level };
}

/** A user who signed up `daysAgo` days ago. */
async function person(daysAgo: number): Promise<string> {
  const userId = randomUUID();
  const at = new Date(Date.now() - daysAgo * 86_400_000);
  await h.db.withUser({ userId, role: 'user' }, (tx) => tx.insertInto('users').values({ id: userId, identity_sub: `local|biz-${userId}`, email: `u-${userId.slice(0, 8)}@${DOMAIN}`, created_at: at }).execute());
  return userId;
}

async function run(userId: string, status: 'ready' | 'failed', options: { minutesAfterSignup?: number; signedUp?: Date; retried?: boolean } = {}) {
  const created = options.signedUp ? new Date(options.signedUp.getTime() + (options.minutesAfterSignup ?? 10) * 60_000) : new Date(Date.now() - 60 * 60_000);
  await h.db.withUser({ userId, role: 'user' }, (tx) =>
    tx
      .insertInto('generations')
      .values({ user_id: userId, kind: 'resume', idempotency_key: randomUUID(), status, created_at: created, started_at: created, finished_at: new Date(created.getTime() + 40_000), manual_retries: options.retried ? 1 : 0 })
      .execute(),
  );
}

describe('the Overview', () => {
  it('counts sign-ups, activation and reliability from the rows behind them', async () => {
    const before = await overview(h.db, '7d');
    const activated = await person(4);
    const signedUp = await h.db.withSystem('test: read the sign-up time', (tx) => tx.selectFrom('users').select('created_at').where('id', '=', activated).executeTakeFirstOrThrow());
    await run(activated, 'ready', { signedUp: new Date(signedUp.created_at as unknown as string) });
    await person(5); // signed up, never made a resume
    const retried = await person(1);
    await run(retried, 'ready', { retried: true });
    await run(retried, 'failed');

    const after = await overview(h.db, '7d');
    expect(after.signups.value - before.signups.value).toBe(3);
    // Two of the three sign-ups are past their 72 hours; one of those activated.
    expect(after.activation!.basis.cohort - (before.activation?.basis.cohort ?? 0)).toBe(2);
    expect(after.activation!.basis.hit - (before.activation?.basis.hit ?? 0)).toBe(1);
    // Three finished runs; only the one nobody retried counts as reliable.
    expect(after.reliability!.basis.cohort - (before.reliability?.basis.cohort ?? 0)).toBe(3);
    expect(after.reliability!.basis.hit - (before.reliability?.basis.hit ?? 0)).toBe(1);
    expect(after.reliability!.target).toBe(0.98);
    expect(after.generations.days).toHaveLength(14);
    expect(after.pipeline.p95TargetSeconds).toBe(180);
    expect(after.subscriptions.delta).toBeNull();
    expect(after.ats.buckets).toHaveLength(10);
  });
});

describe('the price book', () => {
  it('versions both Pro plans at once, refuses a no-op, and audits the change', async () => {
    const admin = await staffMember('admin');
    const plans = await h.db.withUser({ userId: admin.identity.userId, role: 'admin' }, (tx) => tx.selectFrom('plans').select(['id', 'prices', 'price_version']).where('id', 'in', ['pro_monthly', 'pro_annual']).execute());
    const original = Object.fromEntries(plans.map((plan) => [plan.id, plan.prices])) as Record<string, { USD: number; EUR: number; AUD: number }>;
    const monthly = { USD: 2100, EUR: 2000, AUD: 3100 };
    const annual = { USD: 11900, EUR: 11500, AUD: 17900 };
    const { version } = await business.createPriceVersion(h.db, admin, { monthly, annual }, meta);
    try {
      const book = await business.listPriceBook(h.db);
      expect(book[0]).toMatchObject({ version, monthly, annual, status: 'active', createdBy: { name: 'Bea Business' } });
      expect(book.slice(1).every((row) => row.status === 'retired')).toBe(true);
      await expect(business.createPriceVersion(h.db, admin, { monthly, annual }, meta)).rejects.toMatchObject({ code: 'CONFLICT' });
      const audit = await h.db.withSystem('test: read audit', (tx) => tx.selectFrom('audit_logs').select(['action', 'target_id']).where('actor_user_id', '=', admin.identity.userId).execute());
      expect(audit).toEqual([{ action: 'plan.price_book', target_id: `price_book_v${version}` }]);
    } finally {
      // Put the shared database back: the seeded prices, and no test version in the book.
      await h.db.withUser({ userId: admin.identity.userId, role: 'admin' }, async (tx) => {
        await tx.deleteFrom('price_book_versions').where('version', '>=', version).execute();
        for (const [id, prices] of Object.entries(original)) await tx.updateTable('plans').set({ prices: JSON.stringify(prices) }).where('id', '=', id).execute();
      });
    }
  });

  it('counts the accounts on each plan', async () => {
    const stats = await business.planStats(h.db);
    expect(typeof stats.active.free).toBe('number');
  });
});

describe('comped access', () => {
  it('lists a running comp with who granted it and why, and ends it once', async () => {
    const admin = await staffMember('admin');
    const userId = await person(0);
    await users.grantComp(h.db, admin, userId, 2, 'Support ticket 4410', meta);
    const listed = await business.listComps(h.db, 1);
    const comp = listed.rows.find((row) => row.userId === userId);
    expect(comp).toMatchObject({ months: 2, reason: 'Support ticket 4410', grantedBy: { name: 'Bea Business', role: 'admin' } });

    await business.endComp(h.db, admin, comp!.id, meta);
    expect((await business.listComps(h.db, 1)).rows.some((row) => row.userId === userId)).toBe(false);
    await expect(business.endComp(h.db, admin, comp!.id, meta)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(business.endComp(h.db, admin, 'not-a-comp', meta)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const ended = await h.db.withSystem('test: read audit', (tx) => tx.selectFrom('audit_logs').select('action').where('actor_user_id', '=', admin.identity.userId).where('action', '=', 'user.comp_end').execute());
    expect(ended).toHaveLength(1);
  });
});

describe('job provider traffic', () => {
  it('counts calls and failures per day', async () => {
    await countProviderCall(h.db, PROVIDER, false);
    await countProviderCall(h.db, PROVIDER, false);
    await countProviderCall(h.db, PROVIDER, true);
    const stats = (await business.providerStats(h.db))[PROVIDER]!;
    expect(stats.callsToday).toBe(3);
    expect(stats.errorRate).toBeCloseTo(1 / 3);
    expect(stats.errorTrend).toHaveLength(1);
    const day = await h.db.withSystem('test: read the counter', (tx) => tx.selectFrom('job_provider_calls').select(['calls', 'errors']).where('provider', '=', PROVIDER).where('day', '=', sql<Date>`(now() at time zone 'utc')::date`).executeTakeFirstOrThrow());
    expect(day).toEqual({ calls: 3, errors: 1 });
  });
});

describe('the Analytics report', () => {
  it('serves the funnel, runs, ATS, Free quota use and model usage for a window', async () => {
    const report = await analyticsReport(h.db, '30d');
    expect(report.funnel.steps.map((step) => step.key)).toEqual(['signed_up', 'verified_email', 'first_resume', 'tailored', 'started_pro']);
    expect(report.ats.buckets).toHaveLength(10);
    expect(report.quota.planLabel).toBe('Free plan');
    expect(report.quota.deltaPoints).toBeNull();
    expect(Array.isArray(report.providerUsage.rows)).toBe(true);
  });
});
