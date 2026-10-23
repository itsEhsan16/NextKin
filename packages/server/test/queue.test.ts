import { describe, expect, it } from 'vitest';
import { generationGroup, type Envelope } from '../src/queue/envelope';
import { createMemoryQueue } from '../src/queue/memory';
import { windowStart } from '../src/scheduler/scheduler';
import { createConsumer } from '../src/worker/consumer';
import { createLogger } from '../src/observability/logger';

/** Queue semantics and the consumer (P6-01, P6-03, P6-06), on the in-memory adapter. */

const log = createLogger('silent', 'test');
const UID = '00000000-0000-7000-8000-00000000000a';
const gen = (n: number): Extract<Envelope, { type: 'generation.run' }> => ({
  type: 'generation.run',
  schemaVersion: 1,
  id: String(n),
  correlationId: null,
  payload: { generationId: `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`, userId: UID },
});
const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

describe('the envelope and groups', () => {
  it('a user has two FIFO groups, and a generation always maps to the same one', () => {
    const groups = new Set(Array.from({ length: 50 }, (_, n) => generationGroup(UID, gen(n).payload.generationId)));
    expect(groups).toEqual(new Set([`${UID}#0`, `${UID}#1`]));
    expect(generationGroup(UID, gen(7).payload.generationId)).toBe(generationGroup(UID, gen(7).payload.generationId));
  });
});

describe('the memory queue (SQS FIFO semantics)', () => {
  it('one message in flight per group; deduplicates by id; dead-letters after five receives', async () => {
    const q = createMemoryQueue();
    await q.send('generation-standard', gen(1), { groupId: 'g', dedupId: '1' });
    await q.send('generation-standard', gen(1), { groupId: 'g', dedupId: '1' });
    await q.send('generation-standard', gen(2), { groupId: 'g', dedupId: '2' });
    expect(q.contents('generation-standard')).toHaveLength(2);
    const first = await q.receive('generation-standard', { max: 10, waitSeconds: 0, visibilitySeconds: 30 });
    expect(first.map((m) => m.envelope?.id)).toEqual(['1']); // the group is busy until 1 is done
    // Each receive issues a new receipt; give it back at once, as a failing worker's backoff would.
    let current = first[0]!;
    for (let i = 0; i < 5; i++) {
      await q.setVisibility(current, 0);
      const next = await q.receive('generation-standard', { max: 1, waitSeconds: 0, visibilitySeconds: 30 });
      if (next[0]) current = next[0];
    }
    expect((await q.stats('generation-standard-dlq')).visible).toBe(1);
  });
});

describe('the consumer (P6-03)', () => {
  it('drains the priority queue first and never exceeds its concurrency', async () => {
    const q = createMemoryQueue();
    for (let n = 1; n <= 10; n++) await q.send('generation-standard', gen(n), { groupId: `s${n}`, dedupId: `s${n}` });
    await q.send('generation-priority', gen(99), { groupId: 'p', dedupId: 'p' });
    const order: string[] = [];
    let running = 0;
    let peak = 0;
    const consumer = createConsumer({
      name: 't',
      queue: q,
      sources: ['generation-priority', 'generation-standard'],
      concurrency: 3,
      waitSeconds: 0,
      log,
      handler: async (m) => {
        running++;
        peak = Math.max(peak, running);
        order.push(m.envelope!.id);
        await tick(10);
        running--;
      },
    });
    consumer.start();
    while (consumer.metrics.processed < 11) await tick();
    await consumer.stop();
    expect(order[0]).toBe('99');
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('a failing handler is not acknowledged; poison is sent on to the DLQ quickly', async () => {
    const q = createMemoryQueue();
    await q.send('generation-standard', gen(1), { groupId: 'a', dedupId: '1' });
    q.contents('generation-standard').push({ id: 'x', body: '{"not":"an envelope"}', groupId: 'b', dedupId: 'x', sentAt: Date.now(), receiveCount: 0, hiddenUntil: 0, receipt: null });
    const consumer = createConsumer({ name: 't', queue: q, sources: ['generation-standard'], concurrency: 2, waitSeconds: 0, log, handler: async () => { throw new Error('boom'); } });
    consumer.start();
    while ((await q.stats('generation-standard-dlq')).visible < 1) await tick();
    await consumer.stop(10);
    expect(consumer.metrics.poison).toBeGreaterThanOrEqual(5);
    expect(consumer.metrics.failed).toBeGreaterThanOrEqual(1);
    // The good-but-failing message is still in its queue, hidden for its backoff, not acknowledged.
    expect(q.contents('generation-standard').some((m) => m.dedupId === '1')).toBe(true);
  });

  it('stop releases in-flight work it cannot finish in the grace period', async () => {
    const q = createMemoryQueue();
    await q.send('generation-standard', gen(1), { groupId: 'a', dedupId: '1' });
    let release!: () => void;
    const consumer = createConsumer({ name: 't', queue: q, sources: ['generation-standard'], concurrency: 1, waitSeconds: 0, log, handler: () => new Promise((resolve) => (release = () => resolve())) });
    consumer.start();
    while (consumer.metrics.inFlight < 1) await tick();
    const result = await consumer.stop(20);
    expect(result).toEqual({ finished: 0, released: 1 });
    expect((await q.stats('generation-standard')).visible).toBe(1); // visible again for another worker
    release();
  });
});

describe('scheduler windows (P6-06)', () => {
  it('floors to the minute, hour, day and Monday-started week, in UTC', () => {
    const now = new Date('2026-10-14T13:47:22.500Z'); // a Wednesday
    expect(windowStart('minute', now).toISOString()).toBe('2026-10-14T13:47:00.000Z');
    expect(windowStart('hour', now).toISOString()).toBe('2026-10-14T13:00:00.000Z');
    expect(windowStart('day', now).toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(windowStart('week', now).toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });
});
