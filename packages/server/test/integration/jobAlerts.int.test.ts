import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import type { NormalizedJob } from '../../src/jobs/types';
import { applyUrlHashOf } from '../../src/jobs/ids';
import { snapshotOf } from '../../src/jobs/toJob';
import { runMatchAlerts } from '../../src/services/jobAlerts';
import * as notifications from '../../src/services/notifications';
import * as profile from '../../src/services/profile';
import * as push from '../../src/services/push';
import { backendUser } from './fixtures/documents';
import { deleteUsers, log } from './fixtures/pipeline';

/**
 * Job alerts (owner, 2026-11-01): one batch a day, of real, new listings that match well and don't
 * clash with what the candidate asked for. A sample listing never starts one.
 */
const config = loadConfig();
let db: Database;
const users: string[] = [];
const hashes: string[] = [];
const as = (userId: string) => ({ userId, role: 'user' as const });

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 6 });
});
// Other suites cache recorded listings, and this job reads the whole cache.
const clearRealListings = () => db.withSystem('test: clear real listings', (tx) => tx.deleteFrom('jobs_cache').where('provider', 'in', ['adzuna', 'jsearch']).execute());
beforeEach(clearRealListings);
afterEach(async () => {
  await clearRealListings();
  await db.withSystem('test: remove test listings', (tx) => tx.deleteFrom('jobs_cache').where('apply_url_hash', 'in', hashes.splice(0).concat('none')).execute());
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
});

function listing(over: Partial<NormalizedJob> = {}): NormalizedJob {
  const applyUrl = `https://jobs.example/${randomUUID()}`;
  return {
    provider: 'adzuna',
    providerJobId: randomUUID(),
    applyUrl,
    applyUrlHash: applyUrlHashOf(applyUrl),
    title: 'Backend Engineer',
    company: 'Northwind',
    location: 'Berlin',
    country: 'DE',
    remote: 'hybrid',
    employmentType: 'full_time',
    experienceLevel: 'senior',
    postedAt: new Date().toISOString(),
    descriptionKind: 'full',
    description: 'Build services in Go and PostgreSQL on Kubernetes.',
    responsibilities: [],
    requirements: [],
    tags: [],
    requiredSkills: ['Go', 'PostgreSQL', 'Kubernetes'],
    preferredSkills: [],
    companyProfile: { industry: '', size: '', website: '' },
    attribution: { label: 'Jobs by Adzuna' },
    rank: 0,
    ...over,
  };
}

async function cache(job: NormalizedJob) {
  hashes.push(job.applyUrlHash);
  await db.withAnonymous((tx) =>
    tx
      .insertInto('jobs_cache')
      .values({
        apply_url_hash: job.applyUrlHash,
        provider: job.provider === 'link' ? 'fixture' : job.provider,
        provider_job_id: job.providerJobId,
        title: job.title,
        company: job.company,
        location: job.location,
        country: job.country,
        normalized: JSON.stringify(snapshotOf(job)),
        description_kind: job.descriptionKind,
        expires_at: new Date(Date.now() + 24 * 3_600_000),
      })
      .execute(),
  );
}

/** Someone a phone makes "still looking". */
async function looking() {
  const userId = await backendUser(db, users);
  await push.registerDevice(db, as(userId), { platform: 'android', token: randomUUID(), timeZone: 'UTC' });
  return userId;
}

const feed = (userId: string) => notifications.listNotifications(db, as(userId));

describe('job alerts', () => {
  it('stays silent on sample listings', async () => {
    const userId = await looking();
    await cache(listing({ provider: 'fixture' }));
    await runMatchAlerts(db, log);
    expect(await feed(userId)).toHaveLength(0);
  });

  it('tells of new matches once a day, naming the best', async () => {
    const userId = await looking();
    await cache(listing({ title: 'Staff Engineer', company: 'Contoso' }));
    await runMatchAlerts(db, log);
    await runMatchAlerts(db, log);
    const rows = await feed(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: 'matches', body: '**1 new match** today', deepLink: '/jobs' });
    expect(rows[0]!.description).toContain('Staff Engineer at Contoso');
  });

  it('leaves out a weak match, an old listing and a clash, and says so for the clash', async () => {
    const userId = await looking();
    const loaded = await profile.getProfile(db, as(userId));
    await profile.updatePreferences(db, as(userId), loaded.rowVersion, { remote: 'remote' });
    await cache(listing({ remote: 'remote', title: 'Good One' }));
    await cache(listing({ remote: 'onsite', title: 'Office Only' }));
    await cache(listing({ remote: 'remote', title: 'Weak One', requiredSkills: ['Rust', 'Erlang', 'Elixir'] }));
    await cache(listing({ remote: 'remote', title: 'Old One', postedAt: new Date(Date.now() - 3 * 24 * 3_600_000).toISOString() }));
    await runMatchAlerts(db, log);
    const [row] = await feed(userId);
    expect(row!.body).toBe('**1 new match** today');
    expect(row!.description).toBe('Best: Good One at Northwind. 1 left out for not fitting your preferences.');
  });

  it('says nothing about a job they already saved or applied to, or with nothing to match', async () => {
    const empty = await backendUser(db, users);
    await db.withUser(as(empty), async (tx) => {
      await tx.deleteFrom('experience').where('user_id', '=', empty).execute();
      await tx.deleteFrom('profile_skills').where('user_id', '=', empty).execute();
    });
    await push.registerDevice(db, as(empty), { platform: 'android', token: randomUUID(), timeZone: 'UTC' });
    await cache(listing());
    await runMatchAlerts(db, log);
    expect(await feed(empty)).toHaveLength(0);
  });
});
