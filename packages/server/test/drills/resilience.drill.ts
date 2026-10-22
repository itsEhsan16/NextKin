import { execSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAiGateway } from '../../src/ai/gateway';
import { createFakeProvider } from '../../src/ai/providers/fake';
import { createAiSettings } from '../../src/ai/routing';
import { createDbTrace } from '../../src/ai/trace';
import { loadConfig } from '../../src/config';
import { createOutboxRelay } from '../../src/outbox/outbox';
import { capturingPublisher } from '../integration/fixtures/pipeline';
import { HELLO_PIPELINES } from '../../src/pipeline/stages';
import { dlqOf, QUEUES } from '../../src/queue/envelope';
import { createSqsQueue } from '../../src/queue/sqs';
import * as generations from '../../src/services/generations';
import { buildWorker } from '../../src/worker/build';
import { createUser, log } from '../integration/fixtures/pipeline';
import { mobileLogin, registered, startHarness, type Harness } from '../integration/fixtures/authHarness';

/**
 * Resilience drills (ImBackendImplementationPlan P13-02). Each restarts or kills a real piece of the
 * local stack, so they run on their own (`pnpm drills`), never inside the integration suite. The
 * dated results are written to `aws/drills/`.
 *
 * Valkey and ElasticMQ run without persistence locally (docker-compose.yml), so a restart loses
 * what they held; the drills record what the product does about that.
 */
const config = loadConfig();
const ROOT = join(import.meta.dirname, '../../../..');
let h: Harness;
const users: string[] = [];
const queue = createSqsQueue({ region: config.AWS_REGION, endpoint: config.SQS_ENDPOINT, prefix: config.SQS_QUEUE_PREFIX });

function restart(service: string): number {
  const started = Date.now();
  execSync(`docker compose --env-file docker/versions.env restart ${service}`, { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    const state = execSync(`docker compose --env-file docker/versions.env ps ${service} --format "{{.Health}}"`, { cwd: ROOT }).toString().trim();
    if (state === 'healthy' || state === '') break;
    execSync('node -e "setTimeout(()=>{},1000)"');
  }
  return Date.now() - started;
}

const until = async (check: () => Promise<boolean>, ms = 60_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

beforeAll(async () => {
  h = await startHarness({});
});
afterAll(async () => {
  await h.db.withSystem('drills cleanup', (tx) => tx.deleteFrom('users').where('id', 'in', users.length ? users : ['00000000-0000-0000-0000-000000000000']).execute());
  queue.close?.();
  await h.close();
});

describe('resilience drills (P13-02)', () => {
  it('a worker killed mid-stage: another resumes the run after the visibility timeout, charged once', async () => {
    for (const name of [...QUEUES, ...QUEUES.map(dlqOf)]) await queue.purge!(name);
    await h.db.withSystem('drill: settle the outbox', (tx) => tx.updateTable('outbox').set({ published_at: sql`now()` }).where('published_at', 'is', null).execute());
    const userId = await createUser(h.db, users, 'pro');
    const pipelines = HELLO_PIPELINES;
    const gateway = createAiGateway({ settings: createAiSettings(h.db, 0), providers: { resolve: () => createFakeProvider(), isDeveloperKey: () => false }, trace: createDbTrace(h.db, log), log, developer: 'drill', dailyCapUsd: 0 });
    const { generation } = await generations.startGeneration(h.db, { userId, role: 'user' }, { kind: 'resume' }, { idempotencyKey: randomUUID(), correlationId: null });
    await createOutboxRelay({ db: h.db, queue, log }).tick();

    // A real process, so its visibility heartbeat dies with it; its draft stage never returns.
    const dying = spawn(process.execPath, ['--import', 'tsx', join(import.meta.dirname, 'dyingWorker.ts')], { cwd: join(import.meta.dirname, '../..'), env: process.env, stdio: 'ignore' });
    const status = () => h.db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('generations').select('status').where('id', '=', generation.id).executeTakeFirstOrThrow()).then((r) => r.status);
    expect(await until(async () => (await status()) === 'generating', 60_000)).toBe(true);
    dying.kill('SIGKILL');
    const killedAt = Date.now();
    const survivor = buildWorker({ db: h.db, queue, gateway, publisher: capturingPublisher(), log, concurrency: 1, generationTimeoutSeconds: 600, visibilitySeconds: 5, pipelines, relay: false, scheduler: false });
    survivor.start();
    const done = await until(async () => (await h.db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('generations').select('status').where('id', '=', generation.id).executeTakeFirstOrThrow())).status === 'ready', 90_000);
    await survivor.stop(2000);
    expect(done).toBe(true);
    const meter = await h.db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('usage_counters').select(['used', 'reserved']).where('metric', '=', 'generation').executeTakeFirstOrThrow());
    expect(meter).toEqual({ used: 1, reserved: 0 });
    console.log(`DRILL worker-kill: resumed and finished ${Math.round((Date.now() - killedAt) / 1000)} s after the kill; charged once`);
  }, 180_000);

  it('Valkey restart: sessions go (no persistence locally), the API answers 401 not 500, and data is intact', async () => {
    const email = await registered(h);
    const { accessToken } = await mobileLogin(h, email);
    const headers = { authorization: `Bearer ${accessToken}`, 'x-nextkin-client': 'mobile' };
    expect((await h.app.request('/api/v1/me', { headers })).status).toBe(200);
    const ms = restart('valkey');
    let status = 0;
    await until(async () => {
      status = (await h.app.request('/api/v1/me', { headers })).status;
      return status === 401 || status === 200;
    }, 30_000);
    expect([200, 401]).toContain(status);
    // Signing in again works, and nothing durable was lost.
    expect((await mobileLogin(h, email)).accessToken).toBeTruthy();
    console.log(`DRILL valkey-restart: ${ms} ms to healthy; old session answered ${status}; sign-in again works`);
  }, 120_000);

  it('Postgres restart: requests during it fail with the error envelope, and the pool recovers', async () => {
    const email = await registered(h);
    const { accessToken } = await mobileLogin(h, email);
    const headers = { authorization: `Bearer ${accessToken}`, 'x-nextkin-client': 'mobile' };
    const started = Date.now();
    execSync('docker compose --env-file docker/versions.env stop postgres', { cwd: ROOT, stdio: 'ignore' });
    const during = await h.app.request('/api/v1/me', { headers });
    const body = (await during.json().catch(() => null)) as { error?: { code: string } } | null;
    execSync('docker compose --env-file docker/versions.env start postgres', { cwd: ROOT, stdio: 'ignore' });
    expect(during.status).toBe(503);
    expect(body?.error?.code).toBeTruthy();
    const recovered = await until(async () => (await h.app.request('/api/v1/me', { headers })).status === 200, 90_000);
    expect(recovered).toBe(true);
    console.log(`DRILL postgres-restart: answered ${during.status} ${body?.error?.code} while down; recovered ${Math.round((Date.now() - started) / 1000)} s after the stop`);
  }, 180_000);

  it('ElasticMQ restart: unpublished outbox rows republish; a published-but-unconsumed message is lost and the sweep fails its run cleanly', async () => {
    const userId = await createUser(h.db, users, 'pro');
    const id = (await generations.startGeneration(h.db, { userId, role: 'user' }, { kind: 'resume' }, { idempotencyKey: randomUUID(), correlationId: null })).generation.id;
    await createOutboxRelay({ db: h.db, queue, log }).tick(); // published
    const pending = (await generations.startGeneration(h.db, { userId, role: 'user' }, { kind: 'resume' }, { idempotencyKey: randomUUID(), correlationId: null })).generation.id; // still in the outbox
    const ms = restart('elasticmq');
    const relay = await createOutboxRelay({ db: h.db, queue, log }).tick();
    expect(relay.published).toBeGreaterThanOrEqual(1); // the unpublished row goes out after the restart
    const received = await queue.receive('generation-priority', { max: 10, waitSeconds: 2, visibilitySeconds: 5 });
    const ids = received.map((m) => (m.envelope?.payload as { generationId?: string }).generationId);
    expect(ids).toContain(pending);
    expect(ids).not.toContain(id); // lost with the restart (no persistence locally)
    // The sweep ends the lost run with a plain, retryable failure instead of leaving it hanging.
    await h.db.withSystem('drill: age the lost run', (tx) => tx.updateTable('generations').set({ created_at: sql`now() - interval '10 minutes'` }).where('id', '=', id).execute());
    await generations.sweepStuckGenerations(h.db, capturingPublisher(), 180);
    const lost = await h.db.withUser({ userId, role: 'user' }, (tx) => tx.selectFrom('generations').select(['status', 'error_code', 'quota_released_at']).where('id', '=', id).executeTakeFirstOrThrow());
    expect(lost).toMatchObject({ status: 'failed', error_code: 'timed_out' });
    expect(lost.quota_released_at).not.toBeNull();
    console.log(`DRILL elasticmq-restart: ${ms} ms to healthy; outbox republished ${relay.published}; the lost message's run failed as timed_out, quota released`);
  }, 180_000);
});
