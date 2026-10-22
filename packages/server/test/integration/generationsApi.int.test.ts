import { readServerSentEvents, type SseEvent } from '@nextkin/shared/repos/http/sse';
import { HELLO_PIPELINES } from '../../src/pipeline/stages';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createAiGateway } from '../../src/ai/gateway';
import { createRecordedProvider } from '../../src/ai/providers/recorded';
import { createAiSettings } from '../../src/ai/routing';
import { createDbTrace } from '../../src/ai/trace';
import { createValkeyPublisher } from '../../src/pipeline/events';
import { createGenerationHub, type GenerationHub } from '../../src/pipeline/hub';
import { dlqOf, QUEUES } from '../../src/queue/envelope';
import { createSqsQueue } from '../../src/queue/sqs';
import { loadConfig } from '../../src/config';
import { buildWorker, type Worker } from '../../src/worker/build';
import { call, mobileLogin, registered, startHarness, withBearer, type Harness } from './fixtures/authHarness';
import { key, log } from './fixtures/pipeline';

/**
 * The hello-world generation end to end (ImBackendImplementationPlan P6-15) and progress over SSE
 * (P6-13): POST with an Idempotency-Key → outbox → ElasticMQ → worker → one model call (the
 * `recorded` provider, as in CI: no credential, no network) → persisted → SSE `completed`.
 */
const config = loadConfig();
let h: Harness;
let hub: GenerationHub;
let worker: Worker;
const queue = createSqsQueue({ region: config.AWS_REGION, endpoint: config.SQS_ENDPOINT, prefix: config.SQS_QUEUE_PREFIX });

beforeAll(async () => {
  h = await startHarness({
    generations: (valkey) => {
      hub = createGenerationHub(valkey, log);
      return { publisher: createValkeyPublisher(valkey), hub, heartbeatMs: 200, streamMs: 20_000 };
    },
  });
  // The P6 API on hello-world pipelines; the real stages have their own suite.
  worker = buildWorker({
    pipelines: HELLO_PIPELINES,
    db: h.db,
    queue,
    gateway: createAiGateway({ settings: createAiSettings(h.db, 0), providers: { resolve: (f) => (f === 'claude' ? createRecordedProvider() : null), isDeveloperKey: () => false }, trace: createDbTrace(h.db, log), log, developer: 'test', dailyCapUsd: 0 }),
    publisher: createValkeyPublisher(h.valkey),
    log,
    concurrency: 4,
    generationTimeoutSeconds: 180,
    scheduler: false,
  });
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

interface Frame {
  id?: string;
  event?: string;
  data?: { id: string; status: string; progress: number };
  comment?: boolean;
}

/** Reads an SSE response into frames until it ends, `stopAfter` frames arrive, or `ms` pass. */
async function readFrames(res: Response, options: { stopAfter?: number; ms?: number } = {}): Promise<Frame[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const frames: Frame[] = [];
  let buffer = '';
  const deadline = Date.now() + (options.ms ?? 15_000);
  while (Date.now() < deadline) {
    const next = await Promise.race([reader.read(), new Promise<null>((r) => setTimeout(() => r(null), Math.max(1, deadline - Date.now())))]);
    if (!next || next.done) break;
    buffer += decoder.decode(next.value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const frame: Frame = {};
      for (const line of block.split('\n')) {
        if (line.startsWith(':')) frame.comment = true;
        else if (line.startsWith('id:')) frame.id = line.slice(3).trim();
        else if (line.startsWith('event:')) frame.event = line.slice(6).trim();
        else if (line.startsWith('data:')) frame.data = JSON.parse(line.slice(5));
      }
      frames.push(frame);
      if (options.stopAfter && frames.filter((f) => f.event).length >= options.stopAfter) {
        await reader.cancel();
        return frames;
      }
    }
  }
  await reader.cancel().catch(() => {});
  return frames;
}

async function signedIn() {
  const tokens = await mobileLogin(h, await registered(h));
  return withBearer(tokens.accessToken);
}

const startRun = (auth: Record<string, string>, idem = key()) =>
  call(h, '/generations', { body: { kind: 'resume', title: 'Platform Engineer' }, headers: { ...auth, 'idempotency-key': idem } });

describe('the hello-world generation (P6-15)', () => {
  it('POST → outbox → queue → worker → one recorded model call → persisted → SSE completed', async () => {
    const auth = await signedIn();
    const idem = key();
    const created = await startRun(auth, idem);
    expect(created.status).toBe(201);
    const run = (await created.json()) as { id: string; status: string };
    expect(run.status).toBe('queued');
    // A duplicate POST with the same key starts nothing new: the first answer is replayed.
    const again = await startRun(auth, idem);
    expect(again.status).toBe(201);
    expect(again.headers.get('idempotent-replayed')).toBe('true');
    expect(((await again.json()) as { id: string }).id).toBe(run.id);

    const stream = await call(h, `/generations/${run.id}/events`, { headers: auth });
    expect(stream.headers.get('content-type')).toMatch(/text\/event-stream/);
    worker.start();
    const frames = (await readFrames(stream)).filter((f) => f.event);
    expect(frames.map((f) => f.event)).toEqual(['stage_started', 'stage_completed', 'stage_started', 'stage_completed', 'stage_started', 'stage_completed', 'completed']);
    expect(frames.at(-1)!.data).toMatchObject({ id: run.id, status: 'ready', progress: 1 });
    // Event ids only ever increase.
    const ids = frames.map((f) => Number(f.id));
    expect(ids).toEqual([...ids].sort((a, b) => a - b));

    const polled = await call(h, `/generations/${run.id}`, { headers: auth });
    expect(await polled.json()).toMatchObject({ status: 'ready', progress: 1 });
    const trace = await h.db.withSystem('test: the model call', (tx) => tx.selectFrom('ai_calls').select(['provider', 'model', 'outcome', 'tag']).where('generation_id', '=', run.id).execute());
    expect(trace).toEqual([{ provider: 'recorded', model: 'claude-haiku-4-5', outcome: 'ok', tag: 'product' }]);
  });
});

describe('progress over SSE (P6-13)', () => {
  it('a forced drop reconnects at the right event: nothing missed, nothing repeated', async () => {
    const auth = await signedIn();
    const run = (await (await startRun(auth)).json()) as { id: string };
    worker.start();
    const first = await readFrames(await call(h, `/generations/${run.id}/events`, { headers: auth }), { stopAfter: 2 });
    const seen = first.filter((f) => f.event);
    expect(seen).toHaveLength(2);
    const lastId = seen.at(-1)!.id!;
    const rest = (await readFrames(await call(h, `/generations/${run.id}/events`, { headers: { ...auth, 'last-event-id': lastId } }))).filter((f) => f.event);
    expect(rest[0]!.id).not.toBe(lastId);
    expect(Number(rest[0]!.id)).toBeGreaterThan(Number(lastId));
    expect([...seen, ...rest].map((f) => f.event)).toEqual(['stage_started', 'stage_completed', 'stage_started', 'stage_completed', 'stage_started', 'stage_completed', 'completed']);
  });

  it("the shared, phone-safe reader (P6-14's reproduction) reads this server's stream to the end", async () => {
    const auth = await signedIn();
    const run = (await (await startRun(auth)).json()) as { id: string };
    worker.start();
    const events: SseEvent[] = [];
    await readServerSentEvents(await call(h, `/generations/${run.id}/events`, { headers: auth }), (e) => events.push(e));
    expect(events.at(-1)).toMatchObject({ event: 'completed' });
    expect(JSON.parse(events.at(-1)!.data)).toMatchObject({ id: run.id, status: 'ready' });
  });

  it('an idle stream sends heartbeats and stays open until its deadline', async () => {
    await worker.stop(100); // nothing will progress
    const auth = await signedIn();
    const run = (await (await startRun(auth)).json()) as { id: string };
    const started = Date.now();
    const frames = await readFrames(await call(h, `/generations/${run.id}/events`, { headers: auth }), { ms: 1500 });
    expect(frames.filter((f) => f.comment).length).toBeGreaterThanOrEqual(3);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1400);
  });

  it("another user's run is 404, for the stream and for polling", async () => {
    const owner = await signedIn();
    const run = (await (await startRun(owner)).json()) as { id: string };
    const stranger = await signedIn();
    expect((await call(h, `/generations/${run.id}/events`, { headers: stranger })).status).toBe(404);
    expect((await call(h, `/generations/${run.id}`, { headers: stranger })).status).toBe(404);
  });
});

describe('the lifecycle over HTTP (P6-05)', () => {
  it('active, cancel and retry', async () => {
    await worker.stop(100);
    const auth = await signedIn();
    const run = (await (await startRun(auth)).json()) as { id: string };
    expect((await (await call(h, '/generations/active', { headers: auth })).json()) as { generation: { id: string } }).toMatchObject({ generation: { id: run.id } });
    expect((await call(h, `/generations/${run.id}/retry`, { method: 'POST', headers: auth })).status).toBe(409);
    const cancelled = await call(h, `/generations/${run.id}/cancel`, { method: 'POST', headers: auth });
    expect(await cancelled.json()).toMatchObject({ status: 'failed', error: 'Cancelled.' });
    const retried = await call(h, `/generations/${run.id}/retry`, { method: 'POST', headers: auth });
    expect(await retried.json()).toMatchObject({ status: 'queued' });
    worker.start();
    const frames = (await readFrames(await call(h, `/generations/${run.id}/events`, { headers: auth }))).filter((f) => f.event);
    expect(frames.at(-1)!.data).toMatchObject({ status: 'ready' });
  });

  it('POST without an Idempotency-Key is refused', async () => {
    const auth = await signedIn();
    const res = await call(h, '/generations', { body: { kind: 'resume' }, headers: auth });
    expect(res.status).toBe(400);
  });
});
