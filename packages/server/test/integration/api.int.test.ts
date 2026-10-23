import { randomUUID } from 'node:crypto';
import Valkey from 'iovalkey';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createValkeyIdempotencyStore, createValkeyRateLimiter } from '../../src/cache/valkeyStores';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import type { DependencyChecks } from '../../src/health/checks';
import { createApi } from '../../src/http/app';
import type { AuthVia } from '../../src/http/env';

/**
 * The API kernel end to end against Postgres and Valkey (ImBackendImplementationPlan P3 exit):
 * settings exercise ETag/If-Match, links exercise keyset pagination, idempotency and delete, and
 * every call runs the full middleware chain. Authentication is a test-only header resolver here;
 * P4 replaces it with real sessions.
 */
const config = loadConfig();
const ok = async () => {};
const checks: DependencyChecks = { database: ok, valkey: ok, storage: ok, queue: ok };
const ORIGIN = 'http://localhost:3000';

let db: Database;
let valkey: Valkey;
let app: ReturnType<typeof createApi>;
const users: string[] = [];

async function createUser(): Promise<string> {
  const userId = randomUUID();
  await db.withUser({ userId, role: 'user' }, async (tx) => {
    await tx.insertInto('users').values({ id: userId, identity_sub: `apitest|${userId}`, email: `api-${userId}@example.test` }).execute();
    await tx.insertInto('profiles').values({ user_id: userId }).execute();
  });
  users.push(userId);
  return userId;
}

function as(userId: string, via: AuthVia = 'bearer') {
  return (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('x-test-user', userId);
    headers.set('x-test-via', via);
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    return app.request(`/api/v1${path}`, { ...init, headers });
  };
}

beforeAll(async () => {
  db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, poolMax: 4 });
  valkey = new Valkey(config.VALKEY_URL);
  app = createApi({
    checks,
    db,
    config: { appEnv: 'test', appOrigin: ORIGIN, cursorSecret: config.CURSOR_SECRET },
    rateLimiter: createValkeyRateLimiter(valkey),
    idempotency: createValkeyIdempotencyStore(valkey),
    authenticate: async (c) => {
      const userId = c.req.header('x-test-user');
      return userId ? { identity: { userId, role: 'user' }, via: (c.req.header('x-test-via') as AuthVia) ?? 'bearer' } : null;
    },
  });
});

afterAll(async () => {
  if (users.length) await db.withSystem('API suite cleanup', (tx) => tx.deleteFrom('users').where('id', 'in', users).execute());
  await db.destroy();
  await valkey.quit();
});

describe('authentication boundary', () => {
  it('anonymous requests to user resources get 401 in the envelope', async () => {
    const res = await app.request('/api/v1/me/settings');
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  });

  it('authenticated responses are never cacheable', async () => {
    const res = await as(await createUser())('/me/settings');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
});

describe('settings: ETag and If-Match (P3-06)', () => {
  it('defaults first, then a write must name the version it read', async () => {
    const call = as(await createUser());
    const first = await call('/me/settings');
    expect(first.status).toBe(200);
    expect(first.headers.get('etag')).toBe('"v0"');
    expect(await first.json()).toMatchObject({ appSettings: { theme: 'light' }, privacySettings: { profileVisibility: 'private' } });

    const noIfMatch = await call('/me/settings', { method: 'PATCH', body: JSON.stringify({ appSettings: { theme: 'dark' } }) });
    expect(noIfMatch.status).toBe(428);

    const written = await call('/me/settings', { method: 'PATCH', headers: { 'if-match': '"v0"' }, body: JSON.stringify({ appSettings: { theme: 'dark' } }) });
    expect(written.status).toBe(200);
    expect(written.headers.get('etag')).toBe('"v1"');
    expect(await written.json()).toMatchObject({ appSettings: { theme: 'dark', dateFormat: 'd_mmm_y' } });

    const stale = await call('/me/settings', { method: 'PATCH', headers: { 'if-match': '"v0"' }, body: JSON.stringify({ appSettings: { theme: 'light' } }) });
    expect(stale.status).toBe(412);
    expect(((await (await call('/me/settings')).json()) as { appSettings: { theme: string } }).appSettings.theme).toBe('dark');
  });

  it('of two concurrent writers holding the same ETag, exactly one wins', async () => {
    const call = as(await createUser());
    await call('/me/settings', { method: 'PATCH', headers: { 'if-match': '"v0"' }, body: JSON.stringify({ privacySettings: { searchEngines: true } }) });
    const results = await Promise.all(
      ['light', 'system'].map((theme) =>
        call('/me/settings', { method: 'PATCH', headers: { 'if-match': '"v1"' }, body: JSON.stringify({ appSettings: { theme } }) }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 412]);
  });

  it('rejects unknown fields and bad values with field details', async () => {
    const call = as(await createUser());
    const res = await call('/me/settings', { method: 'PATCH', headers: { 'if-match': '"v0"' }, body: JSON.stringify({ appSettings: { theme: 'neon', extra: 1 } }) });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; details: { path: string }[] } };
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.details.length).toBeGreaterThan(0);
  });
});

describe('links: pagination, idempotency, delete', () => {
  it('pages return every link exactly once, even while links are added between pages', async () => {
    const call = as(await createUser());
    for (let i = 0; i < 7; i++) {
      await call('/me/links', { method: 'POST', body: JSON.stringify({ label: `L${i}`, url: `https://example.test/${i}` }) });
    }
    const seen: string[] = [];
    let cursor: string | undefined;
    let added = false;
    do {
      const res = await call(`/me/links?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      const page = (await res.json()) as { items: { id: string; label: string }[]; nextCursor?: string };
      seen.push(...page.items.map((i) => i.label));
      cursor = page.nextCursor;
      if (!added) {
        await call('/me/links', { method: 'POST', body: JSON.stringify({ label: 'late', url: 'https://example.test/late' }) });
        added = true;
      }
    } while (cursor);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.slice(0, 7)).toEqual(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
    expect(seen).toContain('late');
  });

  it('a tampered cursor is a 400, not a different page', async () => {
    const call = as(await createUser());
    const res = await call('/me/links?cursor=eyJrIjoieCIsImkiOiJ5In0.forged');
    expect(res.status).toBe(400);
  });

  it('a retried create with the same Idempotency-Key creates one link and replays the response', async () => {
    const call = as(await createUser());
    const body = JSON.stringify({ label: 'Portfolio', url: 'https://example.test/me', kind: 'portfolio' });
    const key = `create-${randomUUID()}`;
    const first = await call('/me/links', { method: 'POST', headers: { 'idempotency-key': key }, body });
    const second = await call('/me/links', { method: 'POST', headers: { 'idempotency-key': key }, body });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers.get('idempotent-replayed')).toBe('true');
    expect(await second.json()).toEqual(await first.json());
    const list = (await (await call('/me/links')).json()) as { items: unknown[] };
    expect(list.items).toHaveLength(1);
    const reused = await call('/me/links', { method: 'POST', headers: { 'idempotency-key': key }, body: JSON.stringify({ label: 'Other', url: 'https://example.test/x' }) });
    expect(reused.status).toBe(422);
  });

  it('delete is 204, then 404; another user cannot delete it (RLS)', async () => {
    const owner = as(await createUser());
    const intruder = as(await createUser());
    const created = (await (await owner('/me/links', { method: 'POST', body: JSON.stringify({ label: 'Site', url: 'https://example.test/s' }) })).json()) as { id: string };
    expect((await intruder(`/me/links/${created.id}`, { method: 'DELETE' })).status).toBe(404);
    expect((await owner(`/me/links/${created.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await owner(`/me/links/${created.id}`, { method: 'DELETE' })).status).toBe(404);
    expect((await owner('/me/links/not-a-uuid', { method: 'DELETE' })).status).toBe(400);
  });
});

describe('CSRF on cookie sessions (P3-03)', () => {
  it('a cookie-session write needs a same-origin Origin and a JSON body; bearer requests do not', async () => {
    const userId = await createUser();
    const cookie = as(userId, 'cookie');
    const body = JSON.stringify({ label: 'X', url: 'https://example.test/x' });
    expect((await cookie('/me/links', { method: 'POST', body })).status).toBe(403);
    expect((await cookie('/me/links', { method: 'POST', body, headers: { origin: 'https://evil.example' } })).status).toBe(403);
    expect((await cookie('/me/links', { method: 'POST', body, headers: { origin: ORIGIN } })).status).toBe(201);
    expect((await cookie('/me/links', { method: 'POST', body, headers: { origin: ORIGIN, 'content-type': 'text/plain' } })).status).toBe(400);
    // A bodyless delete, as a browser sends it through Next (an empty stream, no length): allowed.
    const empty = new ReadableStream({ start: (controller) => controller.close() });
    expect((await cookie('/me/links/00000000-0000-4000-8000-000000000000', { method: 'DELETE', body: empty, headers: { origin: ORIGIN }, duplex: 'half' } as RequestInit)).status).toBe(404);
    expect((await as(userId, 'bearer')('/me/links', { method: 'POST', body })).status).toBe(201);
  });
});

describe('rate limits on Valkey', () => {
  it('a signed-in user gets 429 with Retry-After after the default class limit', async () => {
    const call = as(await createUser());
    const statuses: number[] = [];
    for (let i = 0; i < 302; i++) statuses.push((await call('/me/settings')).status);
    expect(statuses.slice(0, 300).every((s) => s === 200)).toBe(true);
    const limited = await call('/me/settings');
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
  }, 60_000);
});
