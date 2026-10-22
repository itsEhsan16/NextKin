import { randomUUID } from 'node:crypto';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import { createApi } from '../../src/http/app';

/**
 * One id traces a request into its database work (ImBackendImplementationPlan P3-09, R-14).
 * With a tracer provider registered, the HTTP span and the db.withUser span share a trace id,
 * the request id is that trace id, and an incoming W3C traceparent is continued, not replaced.
 */
const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
provider.register();

const config = loadConfig();
let db: Database;
const userId = randomUUID();

beforeAll(async () => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 2 });
  await db.withUser({ userId, role: 'user' }, (tx) =>
    tx.insertInto('users').values({ id: userId, identity_sub: `trace|${userId}`, email: `trace-${userId}@example.test` }).execute(),
  );
});

afterAll(async () => {
  await db.withSystem('tracing suite cleanup', (tx) => tx.deleteFrom('users').where('id', '=', userId).execute());
  await db.destroy();
  await provider.shutdown();
});

const app = () =>
  createApi({
    checks: { database: async () => {}, valkey: async () => {}, storage: async () => {}, queue: async () => {} },
    db,
    config: { cursorSecret: config.CURSOR_SECRET },
    authenticate: async () => ({ identity: { userId, role: 'user' }, via: 'bearer' }),
  });

describe('tracing', () => {
  it('the request id is the trace id, and the database span belongs to the same trace', async () => {
    exporter.reset();
    const res = await app().request('/api/v1/me/settings');
    expect(res.status).toBe(200);
    const requestId = res.headers.get('x-request-id');
    const spans = exporter.getFinishedSpans();
    const http = spans.find((s) => s.name.startsWith('HTTP GET'));
    const dbSpan = spans.find((s) => s.name === 'db.withUser');
    expect(http?.name).toBe('HTTP GET /api/v1/me/settings');
    expect(dbSpan).toBeDefined();
    expect(dbSpan!.spanContext().traceId).toBe(http!.spanContext().traceId);
    expect(requestId).toBe(http!.spanContext().traceId);
    // Span attributes never carry user data: only role, route and status.
    expect(JSON.stringify(dbSpan!.attributes)).not.toContain(userId);
  });

  it('continues an incoming traceparent', async () => {
    exporter.reset();
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    await app().request('/api/v1/health', { headers: { traceparent: `00-${traceId}-00f067aa0ba902b7-01` } });
    const http = exporter.getFinishedSpans().find((s) => s.name.startsWith('HTTP GET'));
    expect(http?.spanContext().traceId).toBe(traceId);
  });
});
