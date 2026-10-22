import { Writable } from 'node:stream';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createMemoryStores } from '../src/cache/stores';
import { createStaticFlags } from '../src/flags/flags';
import type { DependencyChecks } from '../src/health/checks';
import { createApi } from '../src/http/app';
import { decodeCursor, encodeCursor } from '../src/http/cursor';
import type { ApiEnv } from '../src/http/env';
import { AppError } from '../src/http/errors';
import { etagFor, requireIfMatch } from '../src/http/etag';
import { clientIpFrom } from '../src/http/middleware/context';
import { classify, feature, idempotent } from '../src/http/middleware/guards';
import { createLogger, scrub } from '../src/observability/logger';

const ok = async () => {};
const checks: DependencyChecks = { database: ok, valkey: ok, storage: ok, queue: ok };

describe('request context and envelope', () => {
  const app = createApi({ checks });

  it('issues a request id, or keeps a valid inbound one', async () => {
    const issued = await app.request('/api/v1/health');
    expect(issued.headers.get('x-request-id')).toMatch(/^[0-9a-f]{32}$/);
    const kept = await app.request('/api/v1/health', { headers: { 'x-request-id': 'client-abc-12345' } });
    expect(kept.headers.get('x-request-id')).toBe('client-abc-12345');
    const rejected = await app.request('/api/v1/health', { headers: { 'x-request-id': 'bad id with spaces' } });
    expect(rejected.headers.get('x-request-id')).not.toBe('bad id with spaces');
  });

  it('unknown routes answer the standard envelope', async () => {
    const res = await app.request('/api/v1/nope', { headers: { 'x-request-id': 'req-404-check' } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'No such endpoint.', details: null, request_id: 'req-404-check' } });
  });

  it('sets the security headers', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects an oversized body with 413 and the envelope', async () => {
    const res = await app.request('/api/v1/health', { method: 'POST', body: 'x'.repeat(300 * 1024), headers: { 'content-type': 'text/plain' } });
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('client version floor (P3-07)', () => {
  const app = createApi({ checks, flags: createStaticFlags({ 'clients.minimum_version': { ios: '1.4.0' } }) });

  it('answers 426 with the minimum version when a store build is too old', async () => {
    const res = await app.request('/api/v1/health', { headers: { 'x-client': 'ios', 'x-client-version': '1.3.9' } });
    expect(res.status).toBe(426);
    expect(await res.json()).toMatchObject({ error: { code: 'UPGRADE_REQUIRED', details: { minimumVersion: '1.4.0' } } });
  });

  it('lets current and unidentified clients through', async () => {
    expect((await app.request('/api/v1/health', { headers: { 'x-client': 'ios', 'x-client-version': '1.10.0' } })).status).toBe(200);
    expect((await app.request('/api/v1/health')).status).toBe(200);
  });
});

describe('rate limits (P3-03)', () => {
  it('answers 429 with Retry-After once the class limit is spent, keyed by subject', async () => {
    const stores = createMemoryStores();
    const app = createApi({ checks, rateLimiter: stores.rateLimiter });
    const call = (ip: string) => app.request('/api/v1/nope', { headers: { 'x-forwarded-for': ip } });
    // Without a trusted header configured, every anonymous caller shares the "unknown" subject.
    for (let i = 0; i < 60; i++) await call('1.1.1.1');
    const limited = await call('1.1.1.1');
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(((await limited.json()) as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
  });

  it('health is never rate limited', async () => {
    const stores = createMemoryStores();
    const app = createApi({ checks, rateLimiter: stores.rateLimiter });
    for (let i = 0; i < 80; i++) expect((await app.request('/api/v1/health')).status).toBe(200);
  });

  it('a failing limiter lets the request through (fail open)', async () => {
    const app = createApi({ checks, rateLimiter: { hit: async () => { throw new Error('valkey down'); } } });
    expect((await app.request('/api/v1/nope')).status).toBe(404);
  });

  it('classifies route families', () => {
    expect(classify('/api/v1/auth/login', false).name).toBe('auth');
    expect(classify('/api/v1/generations', true, 'POST')).toMatchObject({ name: 'ai', limit: 20 });
    // Reading a run is not starting one (toreview §110.3).
    expect(classify('/api/v1/generations/some-id', true, 'GET').name).toBe('default');
    expect(classify('/api/v1/me/links', true).name).toBe('default');
  });
});

describe('trusted client IP (P3-04)', () => {
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'cloudfront-viewer-address': '198.51.100.7:51234' });
  it('reads only the configured header', () => {
    expect(clientIpFrom(headers)).toBe('unknown');
    expect(clientIpFrom(headers, 'cloudfront-viewer-address')).toBe('198.51.100.7');
    expect(clientIpFrom(headers, 'x-forwarded-for')).toBe('203.0.113.9');
    expect(clientIpFrom(new Headers({ 'cloudfront-viewer-address': '[2001:db8::1]:443' }), 'cloudfront-viewer-address')).toBe('2001:db8::1');
  });
});

describe('idempotency middleware (R-06)', () => {
  function appWith(onCall: () => number) {
    const { idempotency } = createMemoryStores();
    const app = new Hono<ApiEnv>();
    app.use(async (c, next) => {
      c.set('auth', { identity: { userId: '0192f000-0000-7000-8000-000000000001', role: 'user' }, via: 'bearer' });
      await next();
    });
    app.post('/things', idempotent(idempotency, { required: true }), async (c) => {
      const status = onCall();
      return c.json({ n: status }, status as 201);
    });
    app.onError((e, c) => c.json({ code: (e as AppError).code }, (e as AppError).status as 400));
    return app;
  }

  it('replays the stored response for the same key and body', async () => {
    let calls = 0;
    const app = appWith(() => (calls++, 201));
    const send = () => app.request('/things', { method: 'POST', body: '{"a":1}', headers: { 'idempotency-key': 'key-00000001' } });
    const first = await send();
    const second = await send();
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers.get('idempotent-replayed')).toBe('true');
    expect(await second.json()).toEqual(await first.json());
    expect(calls).toBe(1);
  });

  it('422 for the same key with a different body; 400 when required and missing', async () => {
    const app = appWith(() => 201);
    await app.request('/things', { method: 'POST', body: '{"a":1}', headers: { 'idempotency-key': 'key-00000002' } });
    const reused = await app.request('/things', { method: 'POST', body: '{"a":2}', headers: { 'idempotency-key': 'key-00000002' } });
    expect(await reused.json()).toEqual({ code: 'IDEMPOTENCY_MISMATCH' });
    const missing = await app.request('/things', { method: 'POST', body: '{}' });
    expect(await missing.json()).toEqual({ code: 'VALIDATION_FAILED' });
  });

  it('a server error releases the key so the client can retry', async () => {
    let status = 500;
    let calls = 0;
    const app = appWith(() => (calls++, status));
    const send = () => app.request('/things', { method: 'POST', body: '{}', headers: { 'idempotency-key': 'key-00000003' } });
    expect((await send()).status).toBe(500);
    status = 201;
    expect((await send()).status).toBe(201);
    expect(calls).toBe(2);
  });
});

describe('kill switch (P3-11)', () => {
  it('a feature switched off answers 503 with its degraded message', async () => {
    const app = new Hono<ApiEnv>();
    app.get('/assistant', feature(createStaticFlags({ 'features.assistant.enabled': false }), 'assistant', 'The assistant is resting.'), (c) => c.text('hi'));
    app.onError((e, c) => c.json({ code: (e as AppError).code, message: e.message }, (e as AppError).status as 400));
    const res = await app.request('/assistant');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: 'UNAVAILABLE', message: 'The assistant is resting.' });
  });
});

describe('cursors and ETags (P3-05, P3-06)', () => {
  const secret = 'unit-test-cursor-secret-000000000000';
  it('round-trips a signed cursor and rejects a tampered one', () => {
    const cursor = encodeCursor({ k: '2026-10-10', i: 'abc' }, secret);
    expect(decodeCursor(cursor, secret)).toEqual({ k: '2026-10-10', i: 'abc' });
    const [payload] = cursor.split('.');
    const forged = `${Buffer.from(JSON.stringify({ k: 'x', i: 'zzz' })).toString('base64url')}.${cursor.split('.')[1]}`;
    expect(() => decodeCursor(forged, secret)).toThrow(AppError);
    expect(() => decodeCursor(`${payload}.bad`, secret)).toThrow(AppError);
    expect(() => decodeCursor(cursor, 'another-secret-000000000000000000')).toThrow(AppError);
  });

  it('If-Match: missing is 428, stale is 412, current or weak passes', () => {
    expect(() => requireIfMatch(undefined, 3)).toThrow(expect.objectContaining({ code: 'PRECONDITION_REQUIRED' }));
    expect(() => requireIfMatch('"v2"', 3)).toThrow(expect.objectContaining({ code: 'PRECONDITION_FAILED' }));
    expect(() => requireIfMatch(etagFor(3), 3)).not.toThrow();
    expect(() => requireIfMatch('W/"v3"', 3)).not.toThrow();
  });
});

describe('allowlist logging (R-15, G5)', () => {
  it('drops undeclared fields and masks contact details in kept ones', () => {
    const out = scrub({ event: 'x', route: '/a', body: { email: 'jane@example.com' }, resume: 'secret', purpose: 'mail jane@example.com or +1 (415) 555-0100' });
    expect(out).toEqual({ event: 'x', route: '/a', purpose: 'mail [email] or [phone]', redactedFields: ['body', 'resume'] });
  });

  it('a log line built from a fixture holding an email and a phone contains neither', () => {
    const lines: string[] = [];
    const sink = new Writable({ write(chunk, _enc, done) { lines.push(chunk.toString()); done(); } });
    const log = createLogger('info', 'test', sink);
    log.info({ event: 'profile.saved', profile: { phone: '+49 30 1234567', email: 'max@example.de' }, userId: 'u1' }, 'saved for max@example.de');
    const text = lines.join('');
    expect(text).not.toContain('max@example.de');
    expect(text).not.toContain('1234567');
    expect(text).toContain('"redactedFields":["profile"]');
  });
});
