import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import type { FakeScript } from '../../src/ai/providers/fake';
import { createMemoryKv } from '../../src/cache/kv';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { applyUrlHashOf, jobIdOf } from '../../src/jobs/ids';
import { LinkError, type LinkFailure } from '../../src/links/address';
import { LinkReaderUnavailableError, type LinkReader } from '../../src/links/client';
import type { PageReading } from '../../src/links/reading';
import * as applications from '../../src/services/applications';
import { createJd, getJd, LINK_FAILURE, LINKS_PER_HOUR, runJdExtract } from '../../src/services/jd';
import * as jobs from '../../src/services/jobs';
import { backendUser, JD_TEXT } from './fixtures/documents';
import { createUser, deleteUsers, fakeGateway, log } from './fixtures/pipeline';

/**
 * A job from a link (toreview §144.3), from the address to Saved jobs. The reader is faked here;
 * test/links.test.ts covers it. What this proves is the promise around it: a refusal reaches the
 * candidate as a plain reason, nothing is invented in its place, and a page that is not a job
 * never becomes one.
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

const URL_A = 'https://jobs.example.com/acme/senior-backend-engineer';

const page = (over: Partial<PageReading> = {}): PageReading => ({ url: URL_A, structured: false, text: JD_TEXT, words: 40, ...over });
const reader = (read: LinkReader['read']): LinkReader => ({ read });
const refusing = (reason: LinkFailure) => reader(async () => Promise.reject(new LinkError(reason)));

async function read(userId: string, links: LinkReader, url = URL_A, script: FakeScript = groundedModel, lastAttempt = false) {
  const draft = await createJd(db, as(userId), { source: 'link', url }, null);
  const outcome = await runJdExtract({ db, gateway: fakeGateway(db, script), cache: createMemoryKv(), log, links }, { jdId: draft.id, userId, correlationId: null }, lastAttempt);
  return { id: draft.id, outcome, draft: await getJd(db, as(userId), draft.id) };
}

/** What the model says of a page with no job on it: nothing it can quote. */
const nothingOnThePage: FakeScript = () => ({
  data: { title: null, company: null, location: null, experienceLevel: null, employmentType: null, domain: null, language: 'en', requiredSkills: [], preferredSkills: [], tools: [], responsibilities: [], softSkills: [] },
  text: '',
  stopReason: 'tool_use',
});

describe('a job from a link', () => {
  it('reads the page into a draft, keeping the address', async () => {
    const userId = await backendUser(db, users);
    const { outcome, draft } = await read(userId, reader(async () => page()));
    expect(outcome).toBe('ready');
    expect(draft).toMatchObject({ source: 'link', status: 'ready', sourceUrl: URL_A, rawText: JD_TEXT, jobId: jobIdOf(applyUrlHashOf(URL_A)) });
    expect(draft.requiredSkills.length).toBeGreaterThan(0);
  });

  it('refuses a private address before any work is done', async () => {
    const userId = await backendUser(db, users);
    await expect(createJd(db, as(userId), { source: 'link', url: 'http://169.254.169.254/latest/meta-data/' }, null)).rejects.toMatchObject({ code: 'UNREADABLE_LINK' });
    await expect(createJd(db, as(userId), { source: 'link', url: 'http://localhost/admin' }, null)).rejects.toMatchObject({ code: 'UNREADABLE_LINK' });
  });

  it.each(['refused', 'robots', 'gone', 'unsupported', 'empty', 'timeout'] as LinkFailure[])('a %s page fails with a reason, and nothing invented', async (reason) => {
    const userId = await backendUser(db, users);
    const { outcome, draft } = await read(userId, refusing(reason));
    expect(outcome).toBe('failed');
    expect(draft).toMatchObject({ status: 'failed', error: LINK_FAILURE[reason], rawText: '', requiredSkills: [] });
  });

  it('a page the model finds no job on fails the same way', async () => {
    const userId = await backendUser(db, users);
    const { outcome, draft } = await read(userId, reader(async () => page({ text: 'Sign in to see this page. We could not find what you were looking for on this site today.' })), URL_A, nothingOnThePage);
    expect(outcome).toBe('failed');
    expect(draft.error).toBe(LINK_FAILURE.empty);
  });

  it('a reader that is down tries again, and only the last attempt gives up', async () => {
    const userId = await backendUser(db, users);
    const down = reader(async () => Promise.reject(new LinkReaderUnavailableError('down')));
    await expect(read(userId, down)).rejects.toBeInstanceOf(LinkReaderUnavailableError);
    const second = await read(userId, down, `${URL_A}-2`, groundedModel, true);
    expect(second.outcome).toBe('failed');
  });

  it('answers a link it read recently from the draft it holds', async () => {
    const userId = await backendUser(db, users);
    let reads = 0;
    const counted = reader(async () => {
      reads++;
      return page();
    });
    const first = await read(userId, counted);
    const again = await createJd(db, as(userId), { source: 'link', url: URL_A }, null);
    expect(again.id).toBe(first.id);
    expect(reads).toBe(1);
  });

  it('stops one account using the reader as a free fetch service', async () => {
    const userId = await backendUser(db, users);
    await db.withUser(as(userId), (tx) =>
      tx
        .insertInto('job_descriptions')
        .values(Array.from({ length: LINKS_PER_HOUR }, (_, i) => ({ user_id: userId, source: 'link', raw_text: '', source_url: `${URL_A}/${i}`, status: 'failed' })))
        .execute(),
    );
    await expect(createJd(db, as(userId), { source: 'link', url: `${URL_A}/more` }, null)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('adds the job to Saved jobs, under the plan’s cap, and it can be applied to', async () => {
    const userId = await backendUser(db, users);
    const { id, draft } = await read(userId, reader(async () => page({ closesAt: '2031-01-01T00:00:00.000Z' })));
    const job = await jobs.saveLinkJob(db, as(userId), id);
    expect(job).toMatchObject({ id: draft.jobId, source: 'manual', sourceUrl: URL_A, applyUrl: URL_A, isSaved: true, closingAt: '2031-01-01T00:00:00.000Z' });
    expect((await jobs.saveLinkJob(db, as(userId), id)).id).toBe(job.id);

    const ask = await applications.askAbout(db, as(userId), { jobId: job.id });
    expect(ask).toMatchObject({ jobId: job.id, title: job.title });
  });

  it('will not save someone else’s job description, or one that failed', async () => {
    const owner = await createUser(db, users);
    const other = await createUser(db, users);
    const failed = await read(owner, refusing('refused'));
    await expect(jobs.saveLinkJob(db, as(owner), failed.id)).rejects.toThrow();
    await expect(jobs.saveLinkJob(db, as(other), failed.id)).rejects.toThrow();
  });
});
