import { createMockRepos } from '@nextkin/shared/repos';
import { adoptDocument } from '@nextkin/shared/repos/adopt';
import { createRepos, parseDataSources } from '@nextkin/shared/repos/create';
import { createHttpClient, type TokenStore } from '@nextkin/shared/repos/http/client';
import { createMockStore } from '@nextkin/shared/repos/state';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { groundedModel } from '../../evals/referenceModel';
import { createAiGateway } from '../../src/ai/gateway';
import { createFakeProvider } from '../../src/ai/providers/fake';
import { createAiSettings } from '../../src/ai/routing';
import { createDbTrace } from '../../src/ai/trace';
import { loadConfig } from '../../src/config';
import { LinkError } from '../../src/links/address';
import type { LinkReader } from '../../src/links/client';
import { createValkeyPublisher } from '../../src/pipeline/events';
import { createGenerationHub, type GenerationHub } from '../../src/pipeline/hub';
import { dlqOf, QUEUES } from '../../src/queue/envelope';
import { createSqsQueue } from '../../src/queue/sqs';
import { buildWorker, type Worker } from '../../src/worker/build';
import { mobileLogin, ORIGIN, registered, startHarness, type Harness } from './fixtures/authHarness';
import { backendProfile, JD_TEXT } from './fixtures/documents';
import { log } from './fixtures/pipeline';

/**
 * The whole loop, the way a release build of the phone app runs it (toreview §144.6): every
 * repository on the server, the production configuration, a mobile sign-in, the shared client both
 * apps ship, and a real worker on the real queue. The reference model stands in for Claude and a
 * fake stands in for the link reader, so this runs in CI. If it fails, the phone fails.
 */
const config = loadConfig();
let h: Harness;
let hub: GenerationHub;
let worker: Worker;
const queue = createSqsQueue({ region: config.AWS_REGION, endpoint: config.SQS_ENDPOINT, prefix: config.SQS_QUEUE_PREFIX });

const JOB_URL = 'https://jobs.example.com/acme/senior-backend-engineer';
const REFUSING_URL = 'https://refusing.example.com/job/1';

const links: LinkReader = {
  async read(url) {
    if (url === REFUSING_URL) throw new LinkError('refused');
    return { url, structured: true, title: 'Senior Backend Engineer', company: 'Acme Payments', text: JD_TEXT, words: 40 };
  },
};

beforeAll(async () => {
  h = await startHarness({
    generations: (valkey) => {
      hub = createGenerationHub(valkey, log);
      return { publisher: createValkeyPublisher(valkey), hub, heartbeatMs: 200, streamMs: 20_000 };
    },
  });
  worker = buildWorker({
    db: h.db,
    queue,
    gateway: createAiGateway({
      settings: createAiSettings(h.db, 0),
      providers: { resolve: (f) => (f === 'claude' ? createFakeProvider({ script: groundedModel }) : null), isDeveloperKey: () => false },
      trace: createDbTrace(h.db, log),
      log,
      developer: 'test',
      dailyCapUsd: 0,
      retryDelayMs: () => 0,
    }),
    publisher: createValkeyPublisher(h.valkey),
    log,
    concurrency: 4,
    generationTimeoutSeconds: 180,
    scheduler: false,
    links,
  });
  worker.start();
});
afterAll(async () => {
  await worker.stop(1000);
  await hub.close();
  queue.close();
  await h.close();
});
beforeEach(async () => {
  await h.db.withSystem('test: settle the outbox', (tx) => tx.updateTable('outbox').set({ published_at: sql`now()` }).where('published_at', 'is', null).execute());
  for (const name of [...QUEUES, ...QUEUES.map(dlqOf)]) await queue.purge!(name);
});

async function phone() {
  const email = await registered(h);
  let tokens = { ...(await mobileLogin(h, email)), expiresIn: 3600 };
  const store: TokenStore = { get: async () => tokens, set: async (next) => void (next && (tokens = next)) };
  const requests: string[] = [];
  const http = createHttpClient({
    baseUrl: ORIGIN,
    client: 'mobile',
    platform: 'android',
    tokens: store,
    fetch: (input, init) => {
      requests.push(`${init?.method ?? 'GET'} ${String(input).replace(ORIGIN, '')}`);
      return h.app.request(String(input), init) as Promise<Response>;
    },
  });
  const mockStore = createMockStore();
  const { repos } = createRepos(
    {
      sources: parseDataSources('http'),
      http,
      environment: 'production',
      uploader: async () => {},
      adopt: (doc) => adoptDocument(mockStore, doc),
      adoptJob: () => {},
    },
    createMockRepos(mockStore),
  );
  const user = await h.db.withSystem('test: find the account', (tx) => tx.selectFrom('users').select('id').where('email', '=', email).executeTakeFirstOrThrow());
  await backendProfile(h.db, user.id);
  return { repos, requests };
}

async function finished<T extends { status: string }>(read: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 300; i++) {
    const value = await read();
    if (value.status === 'ready' || value.status === 'failed') return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('the run did not finish');
}

describe('the core loop, as a release build runs it', () => {
  it('copied link → saved job → tailored resume → export asks → applied → notified', async () => {
    const { repos, requests } = await phone();

    // The dialog names the job from the address alone: nothing has left the phone yet.
    const preview = await repos.jobs.readLink(JOB_URL);
    expect(preview.host).toBe('jobs.example.com');
    expect(requests.filter((r) => r.includes('/jd'))).toEqual([]);

    const job = await repos.jobs.importFromLink(JOB_URL);
    expect(job).toMatchObject({ company: 'Acme Payments', sourceUrl: JOB_URL, isSaved: true });
    expect((await repos.jobs.listSaved()).map((saved) => saved.id)).toContain(job.id);

    const started = await repos.generations.start({ kind: 'resume', jobId: job.id });
    const run = await finished(() => repos.generations.get(started.id));
    expect(run.status).toBe('ready');

    const feed = await repos.notifications.list();
    expect(feed).toMatchObject([{ category: 'ai', read: false, deepLink: `/generations/${run.id}` }]);

    const ask = await repos.jobs.askAboutApplication({ jobId: job.id });
    expect(ask).toMatchObject({ jobId: job.id, company: 'Acme Payments' });
    await repos.jobs.answerApplicationAsk(ask!.id, 'yes');
    expect(await repos.jobs.listApplications()).toMatchObject([{ application: { jobId: job.id, status: 'applied' }, job: { sourceUrl: JOB_URL } }]);
  }, 60_000);

  it('a site that refuses reaches the phone as a reason, with no job made up', async () => {
    const { repos } = await phone();
    await expect(repos.jobs.importFromLink(REFUSING_URL)).rejects.toMatchObject({ code: 'UNREADABLE_LINK', message: expect.stringContaining('doesn’t let us read') });
    expect(await repos.jobs.listSaved()).toEqual([]);
  }, 60_000);

  it('holds no sample data: a new account starts empty', async () => {
    const { repos } = await phone();
    expect(await repos.notifications.list()).toEqual([]);
    expect(await repos.jobs.listApplications()).toEqual([]);
    expect(await repos.jobs.listApplicationAsks()).toEqual([]);
    expect(await repos.jobs.listSaved()).toEqual([]);
  }, 30_000);
});
