import { describe, expect, it } from 'vitest';

import { createAiGateway } from '../src/ai/gateway';
import { createFakeProvider } from '../src/ai/providers/fake';
import type { AiSettings, RouteStep } from '../src/ai/routing';
import { createMemoryTrace } from '../src/ai/trace';
import { LlmError } from '../src/ai/types';
import { createLogger } from '../src/observability/logger';
import { extractionSchema } from '../src/parsing/extract';
import { revisionSchema } from '../src/pipeline/stages/validate';
import { parseFailureOf } from '../src/services/resumeParse';

/** The serious findings of toreview §260, each held by a test (owner, 2026-11-23). */

const log = createLogger('silent', 'test');
const step: RouteStep = { provider: 'claude', model: 'm1', maxTokens: 100, inputBudgetTokens: 1000, temperature: 0 };
const settings: AiSettings = { routeFor: async () => [step], prices: async () => ({ version: 1, models: { m1: { inputPerMTok: 1, outputPerMTok: 1, cacheReadPerMTok: 0, cacheWritePerMTok: 0 } } }) };
const call = { stage: 'assistant_reply', system: [{ text: 'Be brief.' }], input: { q: 'x' }, context: { userId: 'u1' } };
const long = 'Led the migration of the billing platform to a new provider. '.repeat(9).trim(); // ~550 characters

describe('a long line is never a reason to refuse a whole answer', () => {
  it('an uploaded resume with a 550-character bullet is read', () => {
    const answer = extractionSchema.shape.roles.element.shape.bullets.safeParse([long]);
    expect(long.length).toBeGreaterThan(400);
    expect(answer.success).toBe(true);
  });

  it('a revision that keeps a 550-character line is accepted', () => {
    expect(revisionSchema.safeParse({ summary: { text: long, evidence: ['f1'] }, skills: null, roles: [] }).success).toBe(true);
  });
});

describe('a retried streaming answer', () => {
  it('starts the caller’s text again, so the saved reply is never two answers glued together', async () => {
    const fake = createFakeProvider({ script: (_r, n) => (n === 1 ? { stopReason: 'max_tokens', text: 'half an answ' } : { text: 'the whole answer' }) });
    const gw = createAiGateway({ settings, providers: { resolve: () => fake, isDeveloperKey: () => false }, trace: createMemoryTrace(), log, developer: 'd', dailyCapUsd: 2, retryDelayMs: () => 0 });
    let shown = '';
    let restarts = 0;
    const { text } = await gw.stream(call, (d) => (shown += d), () => {
      restarts++;
      shown = '';
    });
    expect(restarts).toBe(1);
    expect(shown).toBe('the whole answer');
    expect(text).toBe('the whole answer');
  });
});

describe('why an upload could not be read', () => {
  it('names each failure, and never says "in a moment" for one that won’t pass', () => {
    expect(parseFailureOf(new LlmError('overloaded', 'x', true)).code).toBe('busy');
    expect(parseFailureOf(new LlmError('bad_request', 'x', false)).code).toBe('too_long');
    expect(parseFailureOf(new LlmError('invalid_output', 'x', false)).code).toBe('unclear');
    expect(parseFailureOf(new LlmError('auth', 'x', false)).code).toBe('service_down');
    expect(parseFailureOf(new TypeError('x')).code).toBe('internal');
    for (const failure of ['auth', 'bad_request', 'invalid_output', 'capped'] as const) {
      expect(parseFailureOf(new LlmError(failure, 'x', false)).text).not.toMatch(/in a moment/);
    }
  });
});
