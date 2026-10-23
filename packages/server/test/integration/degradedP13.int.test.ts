import Valkey from 'iovalkey';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAiGateway } from '../../src/ai/gateway';
import { createFakeProvider } from '../../src/ai/providers/fake';
import { createAiSettings } from '../../src/ai/routing';
import { createDbTrace } from '../../src/ai/trace';
import { LlmError } from '../../src/ai/types';
import { createModelBrain, dbPrompts } from '../../src/assistant/brain';
import { createValkeyKv } from '../../src/cache/kv';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { createDegradedSignal } from '../../src/health/degraded';
import { createApi } from '../../src/http/app';
import { createBreaker } from '../../src/jobs/breaker';
import { createProviderRegistry } from '../../src/jobs/registry';
import type { JobProvider } from '../../src/jobs/types';
import type { PaymentProvider } from '../../src/payments/types';
import { createUser, deleteUsers, log } from './fixtures/pipeline';

/**
 * Degraded modes (ImBackendImplementationPlan P13-02, R-09): force each external capability down
 * (the AI providers, the job providers, the payment gateway, email) and the product answers with a
 * plain message while `/health/features` reports the capability degraded, which is what both apps'
 * banner reads. A success clears it again.
 */
const config = loadConfig();
let db: Database;
let valkey: Valkey;
const users: string[] = [];

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 4 });
  valkey = new Valkey(config.VALKEY_URL);
});
afterAll(async () => {
  await deleteUsers(db, users);
  await db.destroy();
  await valkey.quit();
});

const down = <T>(name: string): T => {
  throw new Error(`${name} is down (drill)`);
};

async function api(options: { aiDown: boolean; jobsDown: boolean; payDown: boolean; mailDown: boolean }) {
  // A fresh key space per run, so marks from one case never leak into another.
  const prefix = `drill-${randomUUID().slice(0, 8)}:`;
  const base = createValkeyKv(valkey);
  const kv = { get: (k: string) => base.get(prefix + k), set: (k: string, v: unknown, t: number) => base.set(prefix + k, v, t), setNX: (k: string, v: unknown, t: number) => base.setNX(prefix + k, v, t), del: (k: string) => base.del(prefix + k), incr: (k: string, t: number) => base.incr(prefix + k, t) } as typeof base;
  const signal = createDegradedSignal(kv);
  const userId = await createUser(db, users);
  const ai = createFakeProvider({ script: (r) => (options.aiDown ? new LlmError('unavailable', 'drill', false) : r.output?.name === 'assistant_scope' ? { data: { inScope: true, topic: 'ats' }, stopReason: 'tool_use', text: '' } : { text: 'ok', stopReason: 'end_turn' }) });
  const gateway = createAiGateway({ settings: createAiSettings(db, 0), providers: { resolve: (f) => (f === 'claude' ? ai : null), isDeveloperKey: () => false }, trace: createDbTrace(db, log), log, developer: 'drill', dailyCapUsd: 0, retryDelayMs: () => 0, onAvailability: (ok) => void (ok ? signal.clear('ai') : signal.mark('ai')) });
  const fixture: JobProvider = { name: 'fixture', capabilities: { filters: [], sorts: [] } as never, ttlHours: 1, search: async () => (options.jobsDown ? down('jobs') : []) };
  const pay = { name: 'fake', createCheckout: async () => (options.payDown ? down('payments') : { url: 'http://localhost/checkout', sessionRef: 'cs' }), verifyWebhook: async () => down('n/a'), interpret: () => ({ type: 'ignored', providerType: 'x' }) } as unknown as PaymentProvider;
  const app = createApi({
    checks: {} as never,
    db,
    log,
    degraded: signal,
    authenticate: async () => ({ identity: { userId, role: 'user' }, via: 'bearer' }),
    assistant: { brain: createModelBrain(gateway, dbPrompts(db)) },
    jobs: { kv, registry: createProviderRegistry({ db, providers: { fixture }, log }), breaker: createBreaker(kv) },
    billing: { provider: pay, email: { send: async () => (options.mailDown ? down('email') : undefined) } },
  });
  const call = (method: string, path: string, body?: unknown) => app.request(`/api/v1${path}`, { method, headers: { 'content-type': 'application/json', 'x-nextkin-client': 'mobile' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const features = async () => ((await (await call('GET', '/health/features')).json()) as { status: string; capabilities: { capability: string; degraded: boolean; message?: string }[] });
  return { call, features };
}

describe('degraded modes (P13-02, R-09)', () => {
  it('each capability forced down answers plainly and shows in /health/features; a success clears it', async () => {
    const broken = await api({ aiDown: true, jobsDown: true, payDown: true, mailDown: true });
    expect((await broken.features()).status).toBe('ok');

    const assistant = await broken.call('POST', '/assistant/messages', { text: 'Why is my ATS score low?' });
    expect(assistant.status).toBe(503);
    expect(((await assistant.json()) as { error: { message: string } }).error.message).toMatch(/not available right now/);
    expect((await broken.call('GET', '/jobs/search')).status).toBe(200); // search answers, with what it has
    expect((await broken.call('POST', '/billing/checkout', { planId: 'pro_monthly', country: 'US' })).status).toBe(503);
    // The ticket is kept even though the inbox copy could not be sent.
    expect((await broken.call('POST', '/support/tickets', { topic: 'bug', message: 'drill' })).status).toBe(201);

    const report = await broken.features();
    expect(report.status).toBe('degraded');
    expect(report.capabilities.filter((c) => c.degraded).map((c) => c.capability).sort()).toEqual(['ai', 'email', 'jobs', 'payments']);
    expect(report.capabilities.every((c) => !c.degraded || (c.message ?? '').length > 20)).toBe(true);

    const healthy = await api({ aiDown: false, jobsDown: false, payDown: false, mailDown: false });
    expect((await healthy.call('POST', '/assistant/messages', { text: 'Why is my ATS score low?' })).status).toBe(200);
    expect((await healthy.features()).capabilities.find((c) => c.capability === 'ai')!.degraded).toBe(false);
  }, 60_000);
});
