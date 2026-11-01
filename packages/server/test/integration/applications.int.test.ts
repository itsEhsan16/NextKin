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
import * as notifications from '../../src/services/notifications';
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

describe('follow-ups', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const applyDaysAgo = async (userId: string, days: number) => {
    const job = await aListing(userId);
    const application = await applications.recordApplied(db, as(userId), job.id);
    await db.withUser(as(userId), (tx) => tx.updateTable('applications').set({ applied_at: new Date(Date.now() - days * DAY) }).where('id', '=', application.id).execute());
    return { job, application };
  };
  const feed = (userId: string) => notifications.listNotifications(db, as(userId));
  const inDays = (days: number) => new Date(Date.now() + days * DAY);

  it('asks at a week, once more at three, and then stops', async () => {
    const userId = await backendUser(db, users);
    const { job, application } = await applyDaysAgo(userId, 8);
    await applications.runFollowUps(db);
    await applications.runFollowUps(db);
    const [row, ...rest] = await feed(userId);
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({ category: 'applications', body: `**Any news from ${job.company}?**`, deepLink: `/applications/${application.id}` });

    await applications.runFollowUps(db, inDays(14));
    expect(await feed(userId)).toHaveLength(2);
    await applications.runFollowUps(db, inDays(90));
    expect(await feed(userId)).toHaveLength(2);
  });

  it('asks nothing in the first week, or once the candidate has said', async () => {
    const userId = await backendUser(db, users);
    await applyDaysAgo(userId, 2);
    await applications.runFollowUps(db);
    expect(await feed(userId)).toHaveLength(0);

    const other = await backendUser(db, users);
    const { application } = await applyDaysAgo(other, 9);
    await applications.checkIn(db, as(other), application.id);
    await applications.runFollowUps(db);
    expect(await feed(other)).toHaveLength(0);

    const closed = await backendUser(db, users);
    const moved = await applyDaysAgo(closed, 9);
    await applications.setStatus(db, as(closed), moved.application.id, 'not_selected');
    await applications.runFollowUps(db, inDays(30));
    expect(await feed(closed)).toHaveLength(0);
  });

  it('keeps a day only on an interview, and answers a follow-up with any status', async () => {
    const userId = await backendUser(db, users);
    const { application } = await applyDaysAgo(userId, 1);
    const day = inDays(3).toISOString();
    const interview = await applications.setStatus(db, as(userId), application.id, 'interview', day);
    expect(interview).toMatchObject({ status: 'interview', interviewAt: day });
    expect(interview.checkedAt).toBeDefined();
    expect((await applications.setStatus(db, as(userId), application.id, 'interview')).interviewAt).toBe(day);
    expect((await applications.setStatus(db, as(userId), application.id, 'interview', null)).interviewAt).toBeUndefined();
    await applications.setStatus(db, as(userId), application.id, 'interview', day);
    expect((await applications.setStatus(db, as(userId), application.id, 'offer')).interviewAt).toBeUndefined();
  });

  it('reminds once, the day before a dated interview, and again if the day moves', async () => {
    const userId = await backendUser(db, users);
    const { job, application } = await applyDaysAgo(userId, 1);
    const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();
    await applications.setStatus(db, as(userId), application.id, 'interview', hours(50));
    await applications.runInterviewReminders(db);
    expect(await feed(userId)).toHaveLength(0);

    await applications.setStatus(db, as(userId), application.id, 'interview', hours(24));
    await applications.runInterviewReminders(db);
    await applications.runInterviewReminders(db);
    const [row, ...rest] = await feed(userId);
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({ body: `**Your ${job.company} interview is coming up**`, deepLink: `/applications/${application.id}` });

    await applications.setStatus(db, as(userId), application.id, 'interview', hours(30));
    await applications.runInterviewReminders(db);
    expect(await feed(userId)).toHaveLength(2);
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
