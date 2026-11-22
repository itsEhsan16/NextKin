import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createAiGateway } from '../src/ai/gateway';
import { createFakeProvider } from '../src/ai/providers/fake';
import { type AiSettings, type RouteStep } from '../src/ai/routing';
import { createMemoryTrace } from '../src/ai/trace';
import { LlmError } from '../src/ai/types';
import { createLogger } from '../src/observability/logger';
import { checkDeadline, withDeadline } from '../src/pipeline/deadline';
import { failureOf, FAILURE_MESSAGE, isTransient } from '../src/pipeline/runner';
import { StageError } from '../src/pipeline/stages';
import { createMemoryQueue } from '../src/queue/memory';
import { createConsumer, HandlerTimeoutError } from '../src/worker/consumer';

/** A run always ends with a reason (owner, 2026-11-22): classification, the deadline, the handler cap. */

const log = createLogger('silent', 'test');
const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

describe('why a run failed', () => {
  it('names each model failure instead of calling everything an outage', () => {
    expect(failureOf(new LlmError('invalid_output', 'x', false), false)).toEqual(['invalid_output', FAILURE_MESSAGE.invalid_output]);
    expect(failureOf(new LlmError('bad_request', 'x', false), false)).toEqual(['too_large', FAILURE_MESSAGE.too_large]);
    expect(failureOf(new LlmError('capped', 'x', false), false)).toEqual(['capped', FAILURE_MESSAGE.capped]);
    expect(failureOf(new LlmError('auth', 'x', false), false)).toEqual(['provider', FAILURE_MESSAGE.provider]);
    expect(failureOf(new LlmError('overloaded', 'x', true), true)).toEqual(['dead_lettered', FAILURE_MESSAGE.dead_lettered]);
  });

  it('shows a stage’s own reason, written for the candidate', () => {
    expect(failureOf(new StageError('profile_empty', 'Add at least one role.'), false)).toEqual(['profile_empty', 'Add at least one role.']);
  });

  it('a programming error fails at once instead of five redeliveries', () => {
    expect(isTransient(new TypeError('x of undefined'))).toBe(false);
    const zod = (() => {
      try {
        z.string().parse(1);
      } catch (e) {
        return e;
      }
    })();
    expect(isTransient(zod)).toBe(false);
    expect(failureOf(new TypeError('x'), false)).toEqual(['internal', FAILURE_MESSAGE.internal]);
    // A database blip or a dropped connection may pass on a redelivery.
    expect(isTransient(new Error('Connection terminated'))).toBe(true);
    expect(isTransient(new LlmError('rate_limited', 'x', true))).toBe(true);
  });
});

describe('the run deadline', () => {
  it('a passed deadline stops the work with a timed-out reason', async () => {
    await expect(withDeadline(new Date(Date.now() - 1), async () => checkDeadline())).rejects.toMatchObject({ code: 'timed_out' });
    await expect(withDeadline(new Date(Date.now() + 60_000), async () => (checkDeadline(), 'ok'))).resolves.toBe('ok');
    await expect(withDeadline(null, async () => (checkDeadline(), 'ok'))).resolves.toBe('ok');
  });

  it('the gateway makes no model call once the run is past its deadline', async () => {
    const fake = createFakeProvider();
    const step: RouteStep = { provider: 'claude', model: 'm1', maxTokens: 100, inputBudgetTokens: 1000, temperature: 0 };
    const settings: AiSettings = { routeFor: async () => [step], prices: async () => ({ version: 1, models: { m1: { inputPerMTok: 1, outputPerMTok: 1, cacheReadPerMTok: 0, cacheWritePerMTok: 0 } } }) };
    const gw = createAiGateway({ settings, providers: { resolve: () => fake, isDeveloperKey: () => false }, trace: createMemoryTrace(), log, developer: 'd', dailyCapUsd: 2, retryDelayMs: () => 0 });
    const call = { stage: 's', system: [{ text: 'Be brief.' }], input: { role: 'Engineer' }, context: { userId: 'u1', generationId: 'g1' } };
    await expect(withDeadline(new Date(Date.now() - 1), () => gw.generate(call))).rejects.toBeInstanceOf(StageError);
    expect(fake.calls).toHaveLength(0);
  });

  it('an answer cut off by the token limit is asked again with more room, never accepted', async () => {
    const fake = createFakeProvider({ script: () => ({ stopReason: 'max_tokens' }) });
    const step: RouteStep = { provider: 'claude', model: 'm1', maxTokens: 100, inputBudgetTokens: 1000, temperature: 0 };
    const settings: AiSettings = { routeFor: async () => [step], prices: async () => ({ version: 1, models: { m1: { inputPerMTok: 1, outputPerMTok: 1, cacheReadPerMTok: 0, cacheWritePerMTok: 0 } } }) };
    const gw = createAiGateway({ settings, providers: { resolve: () => fake, isDeveloperKey: () => false }, trace: createMemoryTrace(), log, developer: 'd', dailyCapUsd: 2, retryDelayMs: () => 0 });
    const call = { stage: 's', system: [{ text: 'Be brief.' }], input: { role: 'Engineer' }, context: { userId: 'u1', generationId: 'g1' } };
    await expect(gw.generate(call)).rejects.toMatchObject({ failure: 'invalid_output' });
    // The fake keeps the request by reference: two calls, the second with twice the room.
    expect(fake.calls).toHaveLength(2);
    expect(fake.calls.at(-1)!.maxTokens).toBe(200);
  });
});

describe('the handler cap', () => {
  it('a handler that never returns is given up on and its slot freed', async () => {
    const q = createMemoryQueue();
    await q.send('generation-standard', { type: 'generation.run', schemaVersion: 1, id: '1', correlationId: null, payload: { generationId: '00000000-0000-7000-8000-000000000001', userId: '00000000-0000-7000-8000-00000000000a' } }, { groupId: 'a', dedupId: '1' });
    const consumer = createConsumer({ name: 't', queue: q, sources: ['generation-standard'], concurrency: 1, waitSeconds: 0, log, maxHandlerSeconds: 0.05, handler: () => new Promise(() => {}) });
    consumer.start();
    while (consumer.metrics.failed < 1) await tick();
    expect(consumer.metrics.inFlight).toBe(0);
    await consumer.stop(10);
    expect(new HandlerTimeoutError(1).name).toBe('HandlerTimeoutError');
  });
});
