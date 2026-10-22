import { describe, expect, it } from 'vitest';

import { isLiveRoute, LIVE_ROUTES } from '../src/ai/build';
import { createDbTrace, type TraceRow } from '../src/ai/trace';
import type { Database } from '../src/db/database';
import { createLogger } from '../src/observability/logger';

/** Which routes reach a real model, and the cap's spend when a trace row cannot be written (§108). */

const log = createLogger('silent', 'test');

describe('live routes', () => {
  it('every route that reaches a model is live; the stand-ins are not', () => {
    expect([...LIVE_ROUTES].sort()).toEqual(['claudeAws', 'claudeDirect', 'openrouter']);
    for (const route of ['claudeDirect', 'openrouter', 'claudeAws'] as const) expect(isLiveRoute({ LLM_ROUTE: route })).toBe(true);
    for (const route of ['fake', 'recorded'] as const) expect(isLiveRoute({ LLM_ROUTE: route })).toBe(false);
  });
});

const row = (extra: Partial<TraceRow> = {}): TraceRow => ({
  subject_user_id: null,
  generation_id: null,
  stage: 'jd_extract',
  provider: 'openrouter',
  endpoint: 'openrouter.ai/api/v1/messages',
  model: 'claude-haiku-5-5',
  prompt_version_id: null,
  tag: 'dev',
  correlation_id: null,
  developer: 'dev-1',
  truncated: false,
  outcome: 'ok',
  cost_micros: 1200,
  ...extra,
});

/** A database whose trace inserts are rejected (as 0007's provider check rejected `openrouter`). */
function rejectingDb(spentInTable: number): Database {
  return {
    async withSystem(purpose: string) {
      if (purpose.startsWith('ai: record')) throw new Error('new row violates check constraint "ai_calls_provider_check"');
      return { spent: String(spentInTable) };
    },
  } as unknown as Database;
}

describe('the developer cap when a trace row is rejected', () => {
  it("still counts the call's cost toward today's spend", async () => {
    const trace = createDbTrace(rejectingDb(500), log);
    await trace.record(row());
    await trace.record(row({ cost_micros: 300 }));
    expect(await trace.developerSpendTodayMicros('dev-1')).toBe(500 + 1200 + 300);
    expect(await trace.developerSpendTodayMicros('someone-else')).toBe(500);
  });

  it('holds only developer calls, and only for the current UTC day', async () => {
    let now = new Date('2026-10-18T23:59:00Z');
    const trace = createDbTrace(rejectingDb(0), log, () => now);
    await trace.record(row({ tag: 'product', developer: null }));
    await trace.record(row());
    expect(await trace.developerSpendTodayMicros('dev-1')).toBe(1200);
    now = new Date('2026-10-19T00:01:00Z');
    expect(await trace.developerSpendTodayMicros('dev-1')).toBe(0);
  });
});
