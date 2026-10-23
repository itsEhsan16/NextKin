import { describe, expect, it, vi } from 'vitest';
import { ApiError, collectPages, createHttpClient } from '../src/repos/http/client';
import { NotFoundError, PlanLockedError } from '../src/repos/state';

/** The HTTP client core (P5-01): headers, retries, timeouts and every error mapping. */

const json = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const envelope = (code: string, message: string, details: unknown = null) => ({ error: { code, message, details, request_id: 'r-1' } });
const web = (fetch: typeof globalThis.fetch, extra = {}) =>
  createHttpClient({ baseUrl: 'http://api.test', client: 'web', fetch, retryDelayMs: () => 0, ...extra });

describe('requests', () => {
  it('sends the correlation, client and version headers, and the query string', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(200, { ok: 1 }, { etag: '"v3"' }));
    const http = web(fetch, { clientVersion: '2.0.0', platform: 'ios' });
    const result = await http.send('/me', { query: { limit: 5, cursor: undefined } });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('http://api.test/api/v1/me?limit=5');
    expect(init?.headers).toMatchObject({ 'x-client': 'ios', 'x-client-version': '2.0.0' });
    expect((init?.headers as Record<string, string>)['x-request-id']).toMatch(/^cli_[0-9a-f]{16}$/);
    expect(result).toEqual({ data: { ok: 1 }, status: 200, etag: '"v3"' });
  });

  it('204 resolves to null', async () => {
    const http = web(vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(http.request('/x', { method: 'DELETE' })).resolves.toBeNull();
  });
});

describe('retries', () => {
  it('a read is retried once on 503, with the same request id', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json(503, envelope('UNAVAILABLE', 'Down'))).mockResolvedValueOnce(json(200, { ok: true }));
    await expect(web(fetch).request('/x')).resolves.toEqual({ ok: true });
    const ids = fetch.mock.calls.map(([, init]) => (init?.headers as Record<string, string>)['x-request-id']);
    expect(ids[0]).toBe(ids[1]);
  });

  it('a read is retried once on a network failure, and then the failure surfaces', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('offline'));
    await expect(web(fetch).request('/x')).rejects.toMatchObject({ code: 'NETWORK', status: 0 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('a write without an Idempotency-Key is never sent twice', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(503, envelope('UNAVAILABLE', 'Down')));
    await expect(web(fetch).request('/x', { body: { a: 1 } })).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('a write with an Idempotency-Key is retried once, with the same key', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(json(201, { id: '1' }));
    await expect(web(fetch).request('/x', { body: { a: 1 }, idempotencyKey: 'idem_1' })).resolves.toEqual({ id: '1' });
    expect(fetch.mock.calls.map(([, init]) => (init?.headers as Record<string, string>)['idempotency-key'])).toEqual(['idem_1', 'idem_1']);
  });

  it('a 4xx is never retried', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(400, envelope('VALIDATION_FAILED', 'Bad')));
    await expect(web(fetch).request('/x')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('a request that takes too long is aborted as NETWORK', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>((_url, init) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    );
    await expect(web(fetch, { timeoutMs: 5 }).request('/x', { method: 'POST' })).rejects.toMatchObject({ code: 'NETWORK', message: expect.stringMatching(/too long/) });
  });
});

describe('error mapping', () => {
  it('NOT_FOUND is a real NotFoundError and PLAN_LOCKED a real PlanLockedError, with the server message', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json(404, envelope('NOT_FOUND', 'No such resume.')))
      .mockResolvedValueOnce(json(402, envelope('PLAN_LOCKED', 'Exports need Pro.')));
    const http = web(fetch);
    const notFound = await http.request('/a').catch((e: unknown) => e);
    expect(notFound).toBeInstanceOf(NotFoundError);
    expect(notFound).toMatchObject({ code: 'NOT_FOUND', message: 'No such resume.' });
    const locked = await http.request('/b').catch((e: unknown) => e);
    expect(locked).toBeInstanceOf(PlanLockedError);
    expect(locked).toMatchObject({ code: 'PLAN_LOCKED', message: 'Exports need Pro.' });
  });

  it.each(['UNREADABLE_FILE', 'UNREADABLE_LINK', 'ZERO_BLANK', 'CONFLICT', 'PRECONDITION_FAILED', 'RATE_LIMITED', 'UPGRADE_REQUIRED'])('%s keeps its code, status, details and the verbatim message', async (code) => {
    const message = "Add the real start date — a blank can't stay.";
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(422, envelope(code, message, { field: 'x' })));
    await expect(web(fetch).request('/x', { method: 'POST' })).rejects.toMatchObject({ code, message, status: 422, details: { field: 'x' }, requestId: 'r-1' });
  });

  it('a body that is not an envelope is a generic error, never a crash', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('<html>bad gateway</html>', { status: 500 }));
    await expect(web(fetch).request('/x', { method: 'POST' })).rejects.toMatchObject({ code: 'INTERNAL', status: 500 });
  });
});

describe('collectPages', () => {
  it('follows cursors to the end, and stops at the bound', async () => {
    const pages: Record<string, { items: number[]; nextCursor?: string }> = { start: { items: [1, 2], nextCursor: 'b' }, b: { items: [3], nextCursor: 'c' }, c: { items: [4] } };
    await expect(collectPages(async (cursor) => pages[cursor ?? 'start']!)).resolves.toEqual([1, 2, 3, 4]);
    await expect(collectPages(async (cursor) => pages[cursor ?? 'start']!, 2)).resolves.toEqual([1, 2, 3]);
  });
});
