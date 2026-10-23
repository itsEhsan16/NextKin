import { randomUUID } from 'node:crypto';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config';
import { inspectDlq, replayDlq } from '../../src/ops/dlq';
import { dlqOf } from '../../src/queue/envelope';
import { createSqsQueue } from '../../src/queue/sqs';

/**
 * DLQ tooling against ElasticMQ (ImBackendImplementationPlan P13-05): inspection shows ids and
 * counts and leaves the messages where they are; a dry run changes nothing; a replay moves the
 * parseable messages of the chosen type back to their source queue and leaves the rest.
 */
const config = loadConfig();
const queue = createSqsQueue({ region: config.AWS_REGION, endpoint: config.SQS_ENDPOINT, prefix: config.SQS_QUEUE_PREFIX });

beforeEach(async () => {
  for (const name of ['maintenance', dlqOf('maintenance')] as const) await queue.purge!(name);
});
afterAll(() => queue.close?.());

const dead = (type: 'billing.webhook' | 'account.export', id = randomUUID()) =>
  queue.send(
    dlqOf('maintenance'),
    type === 'billing.webhook'
      ? { type, schemaVersion: 1, id: `o-${id}`, correlationId: null, payload: { webhookEventId: id } }
      : { type, schemaVersion: 1, id: `o-${id}`, correlationId: null, payload: { exportId: id, userId: randomUUID() } },
    { groupId: `g-${id}`, dedupId: `d-${id}` },
  );

describe('DLQ tooling (P13-05)', () => {
  it('inspects without consuming, dry-runs without changing, and replays one type', async () => {
    await dead('billing.webhook');
    await dead('billing.webhook');
    await dead('account.export');

    const listed = await inspectDlq(queue, 'maintenance');
    expect(listed.map((e) => e.type).sort()).toEqual(['account.export', 'billing.webhook', 'billing.webhook']);
    expect(listed[0]!.ids).toBeTruthy();
    expect(listed.every((e) => /^[0-9a-f]{10}$/.test(e.group))).toBe(true);
    expect((await inspectDlq(queue, 'maintenance')).length).toBe(3); // still there

    const dry = await replayDlq(queue, 'maintenance', { type: 'billing.webhook' });
    expect(dry).toMatchObject({ applied: false, replayed: 0, skipped: 1 });
    expect(dry.entries).toHaveLength(2);
    expect((await queue.stats(dlqOf('maintenance'))).visible + (await queue.stats(dlqOf('maintenance'))).inFlight).toBe(3);

    const real = await replayDlq(queue, 'maintenance', { apply: true, type: 'billing.webhook' });
    expect(real).toMatchObject({ applied: true, replayed: 2, skipped: 1 });
    const back = await queue.receive('maintenance', { max: 10, waitSeconds: 1, visibilitySeconds: 5 });
    expect(back.map((m) => m.envelope?.type)).toEqual(['billing.webhook', 'billing.webhook']);
    const left = await inspectDlq(queue, 'maintenance');
    expect(left.map((e) => e.type)).toEqual(['account.export']);
  }, 60_000);
});
