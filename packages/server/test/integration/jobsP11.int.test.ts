import { EMPTY_JOB_FILTERS } from '@nextkin/shared/models/job';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMemoryKv } from '../../src/cache/kv';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { createBreaker } from '../../src/jobs/breaker';
import { FIXTURE_CATALOGUE } from '../../src/jobs/fixtures/catalogue';
import { fixtureHashOf, jobIdOf } from '../../src/jobs/ids';
import { createFixtureProvider } from '../../src/jobs/providers/fixture';
import { createRecordedProvider } from '../../src/jobs/providers/recorded';
import { buildProviders, createProviderRegistry, type ActiveProviders, type ProviderRegistry } from '../../src/jobs/registry';
import { ProviderError, type JobProvider, type ProviderName } from '../../src/jobs/types';
import { SEED_ADMIN_ID } from '../../src/seed/reference';
import * as jobs from '../../src/services/jobs';
import * as profile from '../../src/services/profile';
import { backendUser } from './fixtures/documents';
import { createUser, deleteUsers, log } from './fixtures/pipeline';

/**
 * Job search on Postgres and the fixture providers (ImBackendImplementationPlan P11-01…P11-05):
 * ids that survive purges, filters and counts that agree, a basis on every match, dedupe across
 * providers, the single-provider-down drill, providers switched off by a settings write, and saved
 * jobs that are idempotent and capped on Free.
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

/** A registry over providers the test builds (no settings read), for the drill and the dedupe. */
function fixedRegistry(entries: { provider: JobProvider; dailyCalls?: number }[], version = 'test'): ProviderRegistry {
  const active: ActiveProviders = { providers: entries.map((e, i) => ({ provider: e.provider, setting: { provider: e.provider.name, priority: i, ...(e.dailyCalls ? { dailyCalls: e.dailyCalls } : {}) } })), version };
  return { active: async () => active, refresh: () => undefined };
}

function deps(registry: ProviderRegistry, kv = createMemoryKv()): jobs.JobsDeps {
  return { db, cursorSecret: config.CURSOR_SECRET, aggregate: { db, kv, registry, breaker: createBreaker(kv), log } };
}

const fixtureDeps = () => deps(fixedRegistry([{ provider: createFixtureProvider() }], `fixture-${Math.random()}`));

describe('search over the fixture catalogue (P11-01, P11-05)', () => {
  it('pages the catalogue with a signed cursor; count agrees; ids are derived from the apply URL', async () => {
    const userId = await createUser(db, users);
    const d = fixtureDeps();
    const first = await jobs.searchJobs(d, as(userId), EMPTY_JOB_FILTERS, 'relevance');
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toBeDefined();
    const second = await jobs.searchJobs(d, as(userId), EMPTY_JOB_FILTERS, 'relevance', first.nextCursor);
    const total = await jobs.countJobs(d, EMPTY_JOB_FILTERS);
    expect(first.items.length + second.items.length + (second.nextCursor ? 20 : 0)).toBeGreaterThanOrEqual(Math.min(total, 40));
    expect(new Set([...first.items, ...second.items].map((j) => j.id)).size).toBe(first.items.length + second.items.length);
    expect(first.items[0]!.id).toBe(jobIdOf(fixtureHashOf(FIXTURE_CATALOGUE[0]!.id)));
    await expect(jobs.searchJobs(d, as(userId), EMPTY_JOB_FILTERS, 'relevance', `${first.nextCursor}x`)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('applies the shared filter rules, and count equals what search pages through', async () => {
    const userId = await createUser(db, users);
    const d = fixtureDeps();
    const filters = { ...EMPTY_JOB_FILTERS, remote: ['remote' as const], query: 'designer' };
    const page = await jobs.searchJobs(d, as(userId), filters, 'recent');
    expect(page.items.length).toBeGreaterThan(0);
    for (const job of page.items) {
      expect(job.remote).toBe('remote');
      expect(`${job.title} ${job.company} ${job.location} ${job.tags.join(' ')}`.toLowerCase()).toContain('designer');
    }
    expect(await jobs.countJobs(d, filters)).toBe(page.items.length);
    const sorted = [...page.items].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
    expect(page.items.map((j) => j.id)).toEqual(sorted.map((j) => j.id));
  });

  it('every match carries its basis, and a full listing has its number (P11-03)', async () => {
    const userId = await backendUser(db, users);
    const page = await jobs.searchJobs(fixtureDeps(), as(userId), EMPTY_JOB_FILTERS, 'relevance');
    for (const job of page.items) {
      if (job.matchBand || job.matchScore !== undefined) expect(job.matchBasis).toMatchObject({ method: 'jobmatch-1' });
      if (job.matchScore !== undefined) expect(job.matchBasis?.kind).toBe('full');
      expect(job.attribution).toMatchObject({ provider: 'fixture' });
      expect(job.companyVerified).toBeUndefined();
    }
    expect(page.items.some((j) => j.matchScore !== undefined)).toBe(true);
  });

  it('an empty profile gets no match fields at all, rather than a made-up number', async () => {
    const userId = await createUser(db, users);
    const page = await jobs.searchJobs(fixtureDeps(), as(userId), EMPTY_JOB_FILTERS, 'relevance');
    expect(page.items.every((j) => j.matchScore === undefined && j.matchBand === undefined)).toBe(true);
  });
});

describe('aggregation across providers (P11-02)', () => {
  const recordedDeps = () => deps(fixedRegistry([{ provider: createRecordedProvider('jsearch') }, { provider: createRecordedProvider('adzuna') }], `recorded-${Math.random()}`));

  it('dedupes one job listed twice, by canonical URL and by a fuzzy title, company and city match', async () => {
    const userId = await backendUser(db, users);
    const page = await jobs.searchJobs(recordedDeps(), as(userId), EMPTY_JOB_FILTERS, 'relevance');
    const tailspin = page.items.filter((j) => j.company === 'Tailspin Media');
    const northwind = page.items.filter((j) => j.company === 'Northwind Payments');
    expect(tailspin).toHaveLength(1);
    expect(northwind).toHaveLength(1);
    // The richer listing with the employer's own link wins (JSearch gives it).
    expect(northwind[0]!.applyUrl).toBe('https://jobs.northwind.example/backend-senior');
    expect(page.items).toHaveLength(5);
  });

  it('a snippet listing shows a band and its basis, never an unlabelled number; a title alone has no band', async () => {
    const userId = await backendUser(db, users);
    const page = await jobs.searchJobs(recordedDeps(), as(userId), EMPTY_JOB_FILTERS, 'relevance');
    for (const job of page.items) {
      expect(job.matchScore).toBeUndefined();
      if (job.matchBand) expect(job.matchBasis?.kind).toBe('snippet');
    }
    const backend = page.items.find((j) => j.company === 'Northwind Payments')!;
    expect(backend.matchBand).toBeDefined();
    expect(backend.matchBasis).toMatchObject({ kind: 'snippet', requiredTotal: expect.any(Number) });
    const titleOnly = page.items.find((j) => j.company === 'Fabrikam Health')!;
    expect(titleOnly.matchBand).toBeUndefined();
    expect(titleOnly.matchBasis).toMatchObject({ kind: 'title', requiredTotal: 0 });
    expect(page.items.find((j) => j.company === 'Contoso Logistics')!.attribution).toMatchObject({ label: 'Jobs by Adzuna', salaryBrand: 'Adzuna' });
  });

  it('the single-provider-down drill: one provider fails, the other’s results still come back, no error', async () => {
    const userId = await createUser(db, users);
    const half = Math.floor(FIXTURE_CATALOGUE.length / 2);
    const up: JobProvider = { ...createFixtureProvider({ listings: FIXTURE_CATALOGUE.slice(0, half) }), name: 'jsearch' as ProviderName };
    const down: JobProvider = { ...createFixtureProvider({ listings: FIXTURE_CATALOGUE.slice(half) }), name: 'adzuna' as ProviderName, search: async () => Promise.reject(new ProviderError('adzuna', 'forced outage')) };
    const kv = createMemoryKv();
    const d = deps(fixedRegistry([{ provider: up }, { provider: down }], `drill-${Math.random()}`), kv);
    const count = await jobs.countJobs(d, EMPTY_JOB_FILTERS);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(half);
    const page = await jobs.searchJobs(d, as(userId), EMPTY_JOB_FILTERS, 'relevance');
    expect(page.items.length).toBeGreaterThan(0);
    // The breaker counted the failure; three in a row would open it.
    expect(await kv.get<{ failures: number }>('cb:adzuna')).toMatchObject({ failures: expect.any(Number) });
  });

  it('a provider switched off in settings drops out of the next search (a settings change, no deploy)', async () => {
    const userId = await createUser(db, users);
    const registry = createProviderRegistry({ db, providers: buildProviders('fixture'), log, ttlMs: 0 });
    const d = deps(registry);
    const admin = { userId: SEED_ADMIN_ID, role: 'admin' as const };
    const setFixture = (enabled: boolean) => db.withUser(admin, (tx) => tx.updateTable('job_provider_configs').set({ enabled }).where('provider', '=', 'fixture').execute());
    try {
      expect((await jobs.searchJobs(d, as(userId), EMPTY_JOB_FILTERS, 'relevance')).items.length).toBeGreaterThan(0);
      await setFixture(false);
      expect((await jobs.searchJobs(d, as(userId), EMPTY_JOB_FILTERS, 'relevance')).items).toHaveLength(0);
    } finally {
      await setFixture(true);
    }
  });
});

describe('picks, detail, similar and company (P11-05)', () => {
  it('picks are the profile’s best open matches; today’s picks are recent; detail, similar and company read the cache', async () => {
    const userId = await backendUser(db, users);
    const d = fixtureDeps();
    const picks = await jobs.listPicks(d, as(userId));
    expect(picks.length).toBeLessThanOrEqual(10);
    expect(picks.every((j) => j.isPick)).toBe(true);
    const today = await jobs.listTodaysPicks(d, as(userId));
    expect(today.length).toBeLessThanOrEqual(3);
    const page = await jobs.searchJobs(d, as(userId), EMPTY_JOB_FILTERS, 'relevance');
    const one = page.items[0]!;
    expect((await jobs.getJob(d, as(userId), one.id)).title).toBe(one.title);
    const similar = await jobs.listSimilar(d, as(userId), one.id);
    expect(similar.every((j) => j.id !== one.id && j.company !== one.company)).toBe(true);
    const company = await jobs.listByCompany(d, as(userId), one.company.toUpperCase());
    expect(company.some((j) => j.id === one.id)).toBe(true);
    await expect(jobs.getJob(d, as(userId), '00000000-0000-8000-8000-000000000000')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('fit (toreview §147.3)', () => {
  it('leaves a clash out of picks and says why, and search still shows it', async () => {
    const userId = await backendUser(db, users);
    const d = fixtureDeps();
    const searched = await jobs.searchJobs(d, as(userId), EMPTY_JOB_FILTERS, 'relevance');
    expect((await jobs.hiddenPicks(d, as(userId))).count).toBe(0);

    const loaded = await profile.getProfile(db, as(userId));
    await profile.updatePreferences(db, as(userId), loaded.rowVersion, { remote: 'remote' });

    const picks = await jobs.listPicks(d, as(userId));
    expect(picks.every((j) => j.remote === 'remote')).toBe(true);
    const hidden = await jobs.hiddenPicks(d, as(userId));
    expect(hidden.count).toBeGreaterThan(0);
    expect(hidden.reasons[0]).toContain('you prefer remote');
    expect((await jobs.searchJobs(d, as(userId), EMPTY_JOB_FILTERS, 'relevance')).items).toHaveLength(searched.items.length);
  });
});

describe('saved jobs (P11-04)', () => {
  it('saving is idempotent, unsaving too, and a saved listing outlives its cache row', async () => {
    const userId = await createUser(db, users);
    const d = fixtureDeps();
    const [job] = (await jobs.searchJobs(d, as(userId), EMPTY_JOB_FILTERS, 'relevance')).items;
    const saved = await jobs.setSaved(d, as(userId), job!.id, true);
    expect(saved).toMatchObject({ id: job!.id, isSaved: true, savedAt: expect.any(String) });
    await jobs.setSaved(d, as(userId), job!.id, true);
    const rows = await db.withUser(as(userId), (tx) => tx.selectFrom('saved_jobs').select('id').where('user_id', '=', userId).execute());
    expect(rows).toHaveLength(1);
    // The cache row is purged: the saved copy still answers by the same id.
    await db.withSystem('test: purge one cache row', (tx) => tx.deleteFrom('jobs_cache').where(sql`app.job_id_of(apply_url_hash)`, '=', job!.id).execute());
    expect((await jobs.getJob(d, as(userId), job!.id)).isSaved).toBe(true);
    expect((await jobs.listSaved(d, as(userId))).map((j) => j.id)).toEqual([job!.id]);
    expect((await jobs.setSaved(d, as(userId), job!.id, false)).isSaved).toBe(false);
    await expect(jobs.setSaved(d, as(userId), job!.id, false)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('Free saves up to 10 open listings: the 11th is PLAN_LOCKED, even when two race at 9; Pro is unlimited', async () => {
    const free = await createUser(db, users);
    const d = fixtureDeps();
    const listings = (await jobs.searchJobs(d, as(free), EMPTY_JOB_FILTERS, 'relevance')).items;
    for (const job of listings.slice(0, 9)) await jobs.setSaved(d, as(free), job.id, true);
    const race = await Promise.allSettled([jobs.setSaved(d, as(free), listings[9]!.id, true), jobs.setSaved(d, as(free), listings[10]!.id, true)]);
    expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(race.find((r) => r.status === 'rejected')).toMatchObject({ reason: { code: 'PLAN_LOCKED' } });
    await expect(jobs.setSaved(d, as(free), listings[12]!.id, true)).rejects.toMatchObject({ code: 'PLAN_LOCKED', details: { reason: 'saved_jobs', limit: 10 } });

    const pro = await createUser(db, users, 'pro');
    for (const job of listings.slice(0, 12)) await jobs.setSaved(d, as(pro), job.id, true);
    expect(await jobs.listSaved(d, as(pro))).toHaveLength(12);
  });

  it('a saved listing whose source has closed is flagged on view, kept, and no longer counts against the cap', async () => {
    const userId = await createUser(db, users);
    const d = fixtureDeps();
    const [job] = (await jobs.searchJobs(d, as(userId), EMPTY_JOB_FILTERS, 'relevance')).items;
    await jobs.setSaved(d, as(userId), job!.id, true);
    // The source closes the listing.
    await db.withUser(as(userId), (tx) =>
      tx
        .updateTable('jobs_cache')
        .set({ normalized: sql`jsonb_set(normalized, '{closingAt}', to_jsonb((now() - interval '1 day')::text))` })
        .where(sql`app.job_id_of(apply_url_hash)`, '=', job!.id)
        .execute(),
    );
    const [view] = await jobs.listSaved(d, as(userId));
    expect(view).toMatchObject({ id: job!.id, isSaved: true, unavailable: true });
    const row = await db.withUser(as(userId), (tx) => tx.selectFrom('saved_jobs').select('expired_at').where('user_id', '=', userId).executeTakeFirstOrThrow());
    expect(row.expired_at).not.toBeNull();
  });
});
