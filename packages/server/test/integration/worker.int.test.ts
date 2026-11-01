import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { createOutboxRelay, enqueue } from '../../src/outbox/outbox';
import { HELLO_PIPELINES, helloPipeline, type PipelineDef } from '../../src/pipeline/stages';
import { dlqOf, QUEUES } from '../../src/queue/envelope';
import type { QueuePort } from '../../src/queue/port';
import { createSqsQueue } from '../../src/queue/sqs';
import { createScheduler } from '../../src/scheduler/scheduler';
import * as generations from '../../src/services/generations';
import { buildWorker } from '../../src/worker/build';
import { capturingPublisher, createUser, deleteUsers, fakeGateway, key, log } from './fixtures/pipeline';

/**
 * The async backbone against the compose stack: Postgres, and ElasticMQ through the SQS adapter
 * (ImBackendImplementationPlan P6-01 to P6-06 done-whens).
 */
const config = loadConfig();
let db: Database;
let queue: ReturnType<typeof createSqsQueue>;
const users: string[] = [];
const ALL = [...QUEUES, ...QUEUES.map(dlqOf)];

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 10 });
  queue = createSqsQueue({ region: config.AWS_REGION, endpoint: config.SQS_ENDPOINT, prefix: config.SQS_QUEUE_PREFIX });
});
afterAll(async () => {
  await deleteUsers(db, users);
  queue.close();
  await db.destroy();
});

/** Each test starts from empty queues and no pending outbox rows from other suites. */
beforeEach(async () => {
  await db.withSystem('test: settle the outbox', (tx) => tx.updateTable('outbox').set({ published_at: sql`now()` }).where('published_at', 'is', null).execute());
  for (const name of ALL) await queue.purge!(name);
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check: () => Promise<boolean>, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(100);
  }
  throw new Error('timed out waiting');
}

const start = async (userId: string) =>
  (await generations.startGeneration(db, { userId, role: 'user' }, { kind: 'resume', title: 'Engineer' }, { idempotencyKey: key(), correlationId: null })).generation.id;

const statusOf = (ids: string[]) =>
  db.withSystem('test: read statuses', (tx) => tx.selectFrom('generations').select(['id', 'status', 'attempt']).where('id', 'in', ids).execute());

function worker(extra: Partial<Parameters<typeof buildWorker>[0]> = {}) {
  return buildWorker({ db, queue, gateway: fakeGateway(db), publisher: capturingPublisher(), log, concurrency: 4, generationTimeoutSeconds: 180, visibilitySeconds: 10, scheduler: false, pipelines: HELLO_PIPELINES, ...extra });
}

describe('the outbox (P6-02)', () => {
  it('a rolled-back write leaves no message; a committed one is published once', async () => {
    const userId = await createUser(db, users);
    await expect(
      db.withUser({ userId, role: 'user' }, async (tx) => {
        await enqueue(tx, { queue: 'maintenance', groupId: 'x', type: 'maintenance.run', payload: { job: 'trending', windowStart: new Date().toISOString() } });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    const relay = createOutboxRelay({ db, queue, log });
    expect((await relay.tick()).published).toBe(0);
    await start(userId);
    expect(await relay.tick()).toMatchObject({ published: 1, leader: true });
    expect((await queue.stats('generation-standard')).visible).toBe(1);
  });

  it('a relay killed between publishing and marking loses nothing and delivers once (dedup by outbox id)', async () => {
    const userId = await createUser(db, users);
    await start(userId);
    let crashOnce = true;
    const crashing: QueuePort = {
      ...queue,
      async send(q, envelope, options) {
        await queue.send(q, envelope, options);
        if (crashOnce) {
          crashOnce = false;
          throw new Error('process died after publishing');
        }
      },
    };
    expect(await createOutboxRelay({ db, queue: crashing, log }).tick()).toMatchObject({ published: 0, failed: 1 });
    // The row is still pending; let its backoff pass now rather than wait for it.
    await db.withSystem('test: skip the backoff', (tx) => tx.updateTable('outbox').set({ next_attempt_at: null }).where('published_at', 'is', null).execute());
    expect(await createOutboxRelay({ db, queue, log }).tick()).toMatchObject({ published: 1 });
    const received = await queue.receive('generation-standard', { max: 10, waitSeconds: 1, visibilitySeconds: 5 });
    expect(received).toHaveLength(1);
  });

  it('two relays at once never publish a row twice', async () => {
    const userId = await createUser(db, users);
    for (let i = 0; i < 6; i++) await start(await createUser(db, users));
    await start(userId);
    const [a, b] = await Promise.all([createOutboxRelay({ db, queue, log }).tick(), createOutboxRelay({ db, queue, log }).tick()]);
    expect(a.published + b.published).toBe(7);
    expect([a.leader, b.leader].filter(Boolean)).toHaveLength(1);
  });
});

describe('poison and the DLQ (P6-03, P6-05)', () => {
  it('an unparseable message dead-letters quickly and moves the DLQ depth', async () => {
    const sqs = new SQSClient({ region: config.AWS_REGION, endpoint: config.SQS_ENDPOINT });
    const url = `${config.SQS_ENDPOINT}/000000000000/${config.SQS_QUEUE_PREFIX}generation-standard.fifo`;
    await sqs.send(new SendMessageCommand({ QueueUrl: url, MessageBody: '{"garbage":true}', MessageGroupId: 'poison', MessageDeduplicationId: key() }));
    sqs.destroy();
    const w = worker({ relay: false });
    w.start();
    await until(async () => (await queue.stats('generation-standard-dlq')).visible >= 1, 30_000);
    await w.stop(100);
    expect(w.generations.metrics.poison).toBeGreaterThanOrEqual(5);
    expect((await queue.stats('generation-standard')).visible).toBe(0);
  });
});

describe('the worker (P6-01, P6-03, P6-05)', () => {
  it('five runs from one user run at most two at a time', async () => {
    const userId = await createUser(db, users, 'pro');
    let running = 0;
    let peak = 0;
    const slow: PipelineDef = {
      ...helloPipeline,
      stages: [{ name: 'draft', status: 'generating', run: async () => { running++; peak = Math.max(peak, running); await sleep(400); running--; return { output: { summary: 'ok' } }; } }, ...helloPipeline.stages.slice(1)],
    };
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(await start(userId));
    const w = worker({ concurrency: 8, pipelines: { resume: slow, cover_letter: slow, zero_resume: slow, ats_check: slow, interview: slow, section: slow } });
    w.start();
    await until(async () => (await statusOf(ids)).every((r) => r.status === 'ready'), 60_000);
    await w.stop();
    expect(peak).toBeGreaterThanOrEqual(1);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('a Pro run submitted after ten Free runs starts first', async () => {
    const order: string[] = [];
    const recording: PipelineDef = {
      ...helloPipeline,
      stages: [{ name: 'draft', status: 'generating', run: async (ctx) => { order.push(ctx.generationId); return { output: { summary: 'ok' } }; } }, ...helloPipeline.stages.slice(1)],
    };
    const free: string[] = [];
    for (let i = 0; i < 10; i++) free.push(await start(await createUser(db, users)));
    const pro = await start(await createUser(db, users, 'pro'));
    await createOutboxRelay({ db, queue, log }).tick(); // everything is queued before the worker starts
    const w = worker({ concurrency: 1, relay: false, pipelines: { resume: recording, cover_letter: recording, zero_resume: recording, ats_check: recording, interview: recording, section: recording } });
    w.start();
    await until(async () => order.length >= 2);
    await w.stop();
    expect(order[0]).toBe(pro);
    expect(free).toContain(order[1]);
  });

  it('a burst finishes: nothing stays unfinished', async () => {
    const owners = await Promise.all(Array.from({ length: 5 }, () => createUser(db, users, 'pro')));
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) ids.push(await start(owners[i % 5]!));
    const started = Date.now();
    const w = worker({ concurrency: 6 });
    w.start();
    await until(async () => (await statusOf(ids)).every((r) => r.status === 'ready' || r.status === 'failed'), 120_000);
    await w.stop();
    expect((await statusOf(ids)).every((r) => r.status === 'ready')).toBe(true);
    expect(Date.now() - started).toBeLessThan(180_000);
  });

  it('SIGTERM mid-run releases the message; another worker resumes it and it is charged once', async () => {
    const userId = await createUser(db, users);
    let hold: () => void = () => {};
    let entered = false;
    const stuck: PipelineDef = {
      ...helloPipeline,
      stages: [
        helloPipeline.stages[0]!,
        { name: 'check', status: 'validating', run: () => { entered = true; return new Promise((resolve) => (hold = () => resolve({ output: {} }))); } },
        helloPipeline.stages[2]!,
      ],
    };
    const id = await start(userId);
    const first = worker({ pipelines: { resume: stuck, cover_letter: stuck, zero_resume: stuck, ats_check: stuck, interview: stuck, section: stuck } });
    first.start();
    await until(async () => entered);
    expect(await first.stop(50)).toMatchObject({ generations: { released: 1 } });
    const second = worker();
    second.start();
    await until(async () => (await statusOf([id]))[0]?.status === 'ready');
    await second.stop();
    hold(); // the first process's stage finally returns; its write finds the run finished
    await sleep(200);
    const row = (await statusOf([id]))[0]!;
    expect(row.attempt).toBe(2);
    const usage = await db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('usage_counters').select('used').execute());
    expect(usage).toEqual([{ used: 1 }]);
    const checkpoint = await db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('generations').select('checkpoint').where('id', '=', id).executeTakeFirstOrThrow());
    expect((checkpoint.checkpoint as { completed: string[] }).completed).toEqual(['draft', 'check', 'score']);
  });
});

describe('the scheduler (P6-06)', () => {
  it('two workers ticking together never schedule the same run twice', async () => {
    const now = () => new Date('2031-01-06T10:30:00Z'); // a window no other test uses
    // A run that failed part-way leaves its claims behind.
    await db.withSystem('test: forget the far-future claims', (tx) => tx.deleteFrom('scheduler_runs').where('window_start', '>=', new Date('2031-01-01')).execute());
    const a = createScheduler({ db, log, now });
    const b = createScheduler({ db, log, now });
    const [ja, jb] = await Promise.all([a.tick(), b.tick()]);
    const claimed = [...ja, ...jb];
    expect(new Set(claimed).size).toBe(claimed.length);
    expect(claimed.sort()).toEqual(['account_purge', 'anonymous_upload_purge', 'application_follow_ups', 'audit_export', 'closing_alerts', 'eval_nightly', 'event_purge', 'generation_sweep', 'interview_reminders', 'jobs_cache_expiry', 'kb_candidates', 'notification_purge', 'outbox_cleanup', 'trash_purge', 'trending', 'upload_orphan_sweep']);
    expect(await a.tick()).toEqual([]);
    await db.withSystem('test: forget the far-future claims', (tx) => tx.deleteFrom('scheduler_runs').where('window_start', '>=', new Date('2031-01-01')).execute());
  });
});
