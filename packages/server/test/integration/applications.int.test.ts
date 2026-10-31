import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { createMemoryKv } from '../../src/cache/kv';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { createBreaker } from '../../src/jobs/breaker';
import { createFixtureProvider } from '../../src/jobs/providers/fixture';
import type { ProviderRegistry } from '../../src/jobs/registry';
import * as applications from '../../src/services/applications';
import * as jobs from '../../src/services/jobs';
import { backendUser, readyJd, runToEnd } from './fixtures/documents';
import { deleteUsers, log } from './fixtures/pipeline';

/**
 * Applications and "Did you apply?" (owner, 2026-10-31). NextKin submits nothing, so a row is what
 * the candidate said: a finished run waits for the next open, a download asks at once, "not yet"
 * asks once more a day later, and nothing asks twice about a job already answered.
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

const registry = (): ProviderRegistry => {
  const provider = createFixtureProvider();
  const active = { providers: [{ provider, setting: { provider: provider.name, enabled: true } }], version: `applications-${Math.random()}` };
  return { active: async () => active as never, refresh: () => undefined };
};
const jobsDeps = (): jobs.JobsDeps => {
  const kv = createMemoryKv();
  return { db, cursorSecret: config.CURSOR_SECRET, aggregate: { db, kv, registry: registry(), breaker: createBreaker(kv), log } };
};

/** A listing from the fixture catalogue, cached so the service can find it by id. */
async function aListing(userId: string) {
  const page = await jobs.searchJobs(jobsDeps(), as(userId), { query: '', locations: [], companies: [], remote: [], employmentTypes: [], experienceLevels: [], tags: [] } as never, 'relevance');
  return page.items[0]!;
}

/** Moves an ask's wait into the past, as a day going by would. */
const makeDue = (userId: string) => db.withUser(as(userId), (tx) => tx.updateTable('applications').set({ ask_after: new Date(Date.now() - 1000) }).where('status', '=', 'asking').where('asks_left', '>', 0).execute());

describe('applications', () => {
  it('records that the candidate applied, once, and keeps the job as it stood', async () => {
    const userId = await backendUser(db, users);
    const job = await aListing(userId);
    const first = await applications.recordApplied(db, as(userId), job.id);
    const again = await applications.recordApplied(db, as(userId), job.id);
    expect(again.id).toBe(first.id);
    expect(again.appliedAt).toBe(first.appliedAt);
    const listed = await applications.listApplications(db, as(userId));
    expect(listed).toHaveLength(1);
    expect(listed[0]!.job.title).toBe(job.title);
    const moved = await applications.setStatus(db, as(userId), first.id, 'interview');
    expect(moved.status).toBe('interview');
  });

  it("refuses another candidate's application", async () => {
    const owner = await backendUser(db, users);
    const other = await backendUser(db, users);
    const job = await aListing(owner);
    const application = await applications.recordApplied(db, as(owner), job.id);
    await expect(applications.setStatus(db, as(other), application.id, 'offer')).rejects.toThrow();
    await expect(applications.answerAsk(db, as(other), application.id, 'yes')).rejects.toThrow();
    expect(await applications.listApplications(db, as(other))).toHaveLength(0);
  });
});

describe('"Did you apply?"', () => {
  it('asks at once after a trip to the employer, and "yes" joins the Applied list', async () => {
    const userId = await backendUser(db, users);
    const job = await aListing(userId);
    const ask = await applications.askAbout(db, as(userId), { jobId: job.id });
    expect(ask).toMatchObject({ jobId: job.id, title: job.title, company: job.company });
    expect(await applications.listApplications(db, as(userId))).toHaveLength(0);
    await applications.answerAsk(db, as(userId), ask!.id, 'yes');
    expect(await applications.listAsks(db, as(userId))).toHaveLength(0);
    expect(await applications.listApplications(db, as(userId))).toHaveLength(1);
    expect(await applications.askAbout(db, as(userId), { jobId: job.id })).toBeNull();
  });

  it('"not yet" asks once more a day later, then stops', async () => {
    const userId = await backendUser(db, users);
    const job = await aListing(userId);
    const ask = await applications.askAbout(db, as(userId), { jobId: job.id });
    await applications.answerAsk(db, as(userId), ask!.id, 'not_yet');
    expect(await applications.listAsks(db, as(userId))).toHaveLength(0);
    // A second download the same day does not ask again.
    expect(await applications.askAbout(db, as(userId), { jobId: job.id })).toBeNull();
    await makeDue(userId);
    const [second] = await applications.listAsks(db, as(userId));
    expect(second?.id).toBe(ask!.id);
    await applications.answerAsk(db, as(userId), ask!.id, 'not_yet');
    await makeDue(userId);
    expect(await applications.listAsks(db, as(userId))).toHaveLength(0);
  });

  it('"no" ends the asking for that job', async () => {
    const userId = await backendUser(db, users);
    const job = await aListing(userId);
    const ask = await applications.askAbout(db, as(userId), { jobId: job.id });
    await applications.answerAsk(db, as(userId), ask!.id, 'no');
    expect(await applications.askAbout(db, as(userId), { jobId: job.id })).toBeNull();
    expect(await applications.listApplications(db, as(userId))).toHaveLength(0);
  });

  it('a finished run for a job waits for the next open; a run with no job asks nothing', async () => {
    const userId = await backendUser(db, users);
    const noJob = await runToEnd(db, userId, 'resume', {}, groundedModel);
    expect(noJob.outcome).toBe('completed');
    await makeDue(userId);
    expect(await applications.listAsks(db, as(userId))).toHaveLength(0);

    const jd = await readyJd(db, userId, groundedModel);
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id }, groundedModel);
    expect(run.outcome).toBe('completed');
    expect(await applications.listAsks(db, as(userId))).toHaveLength(0);
    await makeDue(userId);
    const [ask] = await applications.listAsks(db, as(userId));
    expect(ask).toMatchObject({ title: jd.title });
  });

  it('a download of a resume made for a job asks about that job; a resume with no job asks nothing', async () => {
    const userId = await backendUser(db, users);
    const base = await runToEnd(db, userId, 'resume', {}, groundedModel);
    expect(await applications.askAbout(db, as(userId), { resumeId: base.resumeId! })).toBeNull();

    const jd = await readyJd(db, userId, groundedModel);
    const run = await runToEnd(db, userId, 'resume', { jdId: jd.id }, groundedModel);
    const ask = await applications.askAbout(db, as(userId), { resumeId: run.resumeId! });
    expect(ask).toMatchObject({ title: jd.title });
    await applications.answerAsk(db, as(userId), ask!.id, 'yes');
    const [applied] = await applications.listApplications(db, as(userId));
    expect(applied!.application.resumeId).toBe(run.resumeId);
    // A job with no listing still opens from its Applied card.
    const shown = await jobs.getJob(jobsDeps(), as(userId), ask!.jobId);
    expect(shown.title).toBe(jd.title);
  });
});
