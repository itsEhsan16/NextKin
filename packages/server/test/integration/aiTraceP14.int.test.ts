import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAiGateway } from '../../src/ai/gateway';
import { createFakeProvider } from '../../src/ai/providers/fake';
import { createDbTrace, type TraceRow } from '../../src/ai/trace';
import type { LlmProvider } from '../../src/ai/types';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { log } from './fixtures/pipeline';

/**
 * The OpenRouter route's trace (toreview §108, migration 0038): its rows are written, and the
 * D-23 developer cap reads their spend and stops the next live call.
 */
const config = loadConfig();
let db: Database;

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 2 });
});
afterAll(async () => {
  await db.destroy();
});

const row = (developer: string, cost: number): TraceRow => ({
  subject_user_id: null,
  generation_id: null,
  stage: 'jd_extract',
  provider: 'openrouter',
  endpoint: 'openrouter.ai/api/v1/messages',
  model: 'claude-haiku-5-5',
  prompt_version_id: null,
  tag: 'dev',
  correlation_id: null,
  developer,
  truncated: false,
  outcome: 'ok',
  cost_micros: cost,
});

describe('the openrouter trace', () => {
  it('writes an openrouter row and counts it toward the developer spend', async () => {
    const developer = `p14-openrouter-${randomUUID()}`;
    const trace = createDbTrace(db, log);
    await trace.record(row(developer, 1500));
    const stored = await db.withSystem('test: read the trace', (tx) => tx.selectFrom('ai_calls').select(['provider', 'cost_micros']).where('developer', '=', developer).execute());
    // cost_micros is a bigint column, so the driver returns it as a string.
    expect(stored.map((r) => ({ provider: r.provider, cost: Number(r.cost_micros) }))).toEqual([{ provider: 'openrouter', cost: 1500 }]);
    expect(await trace.developerSpendTodayMicros(developer)).toBe(1500);
  });

  it('stops the next live call once the day is spent', async () => {
    const developer = `p14-openrouter-${randomUUID()}`;
    const trace = createDbTrace(db, log);
    await trace.record(row(developer, 2000));
    const provider: LlmProvider = { ...createFakeProvider(), name: 'openrouter' };
    const gateway = createAiGateway({
      settings: {
        routeFor: async () => [{ provider: 'claude', model: 'claude-haiku-5-5', maxTokens: 50, inputBudgetTokens: 500, temperature: 0 }],
        prices: async () => ({ version: 1, models: {} }),
      },
      providers: { resolve: (family) => (family === 'claude' ? provider : null), isDeveloperKey: () => true },
      trace,
      log,
      developer,
      dailyCapUsd: 0.001, // 1000 micros, already passed
      retryDelayMs: () => 0,
    });
    await expect(gateway.generate({ stage: 'hello', system: [{ text: 'Say hi.' }], input: { greeting: 'hi' }, context: {} })).rejects.toMatchObject({ failure: 'capped' });
    const outcomes = await db.withSystem('test: read the trace', (tx) => tx.selectFrom('ai_calls').select('outcome').where('developer', '=', developer).execute());
    expect(outcomes.map((o) => o.outcome).sort()).toEqual(['capped', 'ok']);
  });
});
