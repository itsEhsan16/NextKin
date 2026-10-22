import { randomUUID } from 'node:crypto';

import Valkey from 'iovalkey';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createValkeyIdempotencyStore, createValkeyRateLimiter } from '../../src/cache/valkeyStores';
import { loadConfig } from '../../src/config';
import { createDatabase, type Database } from '../../src/db/database';
import type { DependencyChecks } from '../../src/health/checks';
import { createApi } from '../../src/http/app';

/**
 * Every named rate-limit class reaches 429 with Retry-After at its limit, and no sooner
 * (P13-01; spec §9.11, §16.6 "rate limits verified on auth endpoints, generation endpoints, the
 * assistant, and the presign endpoint"). The limiter runs before routing, so the classes are
 * proved here on the real Valkey limiter, whatever each route then answers. Buckets are per route
 * and per account (or per IP when signed out), so exhausting one never touches another.
 */
const config = loadConfig();
const ok = async () => {};
const checks: DependencyChecks = { database: ok, valkey: ok, storage: ok, queue: ok };
const IP_HEADER = 'x-test-client-ip';

let db: Database;
let valkey: Valkey;
let app: ReturnType<typeof createApi>;

beforeAll(() => {
  db = createDatabase({ appUrl: config.DATABASE_URL, poolMax: 2 });
  valkey = new Valkey(config.VALKEY_URL);
  app = createApi({
    checks,
    db,
    config: { appEnv: 'test', appOrigin: 'http://localhost:3000', cursorSecret: config.CURSOR_SECRET, trustedIpHeader: IP_HEADER },
    rateLimiter: createValkeyRateLimiter(valkey),
    idempotency: createValkeyIdempotencyStore(valkey),
    // A signed-in caller is just an id here: the limiter keys on it, and no route needs to run.
    authenticate: async (c) => {
      const userId = c.req.header('x-test-user');
      return userId ? { identity: { userId, role: 'user' }, via: 'bearer' } : null;
    },
  });
});

afterAll(async () => {
  await db.destroy();
  await valkey.quit();
});

const ip = () => `198.51.100.${Math.floor(Math.random() * 250) + 1}-${randomUUID().slice(0, 6)}`;

/** Sends `count` requests and returns their statuses and the last response. */
async function burst(path: string, count: number, who: { user?: string; ip?: string }, method = 'GET') {
  const statuses: number[] = [];
  let last: Response | undefined;
  for (let i = 0; i < count; i++) {
    const headers: Record<string, string> = { 'x-nextkin-client': 'mobile' };
    if (who.user) headers['x-test-user'] = who.user;
    if (who.ip) headers[IP_HEADER] = who.ip;
    last = await app.request(`/api/v1${path}`, { method, headers });
    statuses.push(last.status);
  }
  return { statuses, last: last! };
}

const CLASSES = [
  { name: 'auth, signed out (per IP)', path: '/auth/login', method: 'POST', limit: 10, signedIn: false },
  { name: 'auth, signed in', path: '/auth/logout', method: 'POST', limit: 20, signedIn: true },
  { name: 'starting a run, signed in', path: '/generations', method: 'POST', limit: 20, signedIn: true },
  { name: 'starting a run, signed out (per IP)', path: '/generations', method: 'POST', limit: 5, signedIn: false },
  { name: 'assistant, signed in', path: '/assistant/threads', method: 'GET', limit: 30, signedIn: true },
  { name: 'presign, signed in', path: '/uploads/presign', method: 'POST', limit: 30, signedIn: true },
  { name: 'presign, signed out (per IP)', path: '/uploads/presign', method: 'POST', limit: 5, signedIn: false },
] as const;

describe('rate-limit classes (P13-01, §9.11)', () => {
  for (const cls of CLASSES) {
    it(`${cls.name}: ${cls.limit} a minute, then 429 with Retry-After`, async () => {
      const who = cls.signedIn ? { user: randomUUID() } : { ip: ip() };
      const { statuses } = await burst(cls.path, cls.limit, who, cls.method);
      expect(statuses.filter((s) => s === 429)).toEqual([]);
      const { last } = await burst(cls.path, 1, who, cls.method);
      expect(last.status).toBe(429);
      expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(await last.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    }, 60_000);
  }

  it('buckets are per route: an exhausted assistant allowance leaves generations untouched', async () => {
    const user = randomUUID();
    await burst('/assistant/threads', 31, { user });
    const { last } = await burst('/generations', 1, { user }, 'POST');
    expect(last.status).not.toBe(429);
  }, 60_000);

  it('reading a run is not counted against starting one: its progress screen polls every second', async () => {
    const user = randomUUID();
    const { statuses } = await burst(`/generations/${randomUUID()}`, 40, { user });
    expect(statuses.filter((s) => s === 429)).toEqual([]);
    expect((await burst('/generations', 1, { user }, 'POST')).last.status).not.toBe(429);
  }, 60_000);

  it('buckets are per caller: one user or IP at the limit does not limit another', async () => {
    const a = randomUUID();
    await burst('/generations', 21, { user: a }, 'POST');
    expect((await burst('/generations', 1, { user: a }, 'POST')).last.status).toBe(429);
    expect((await burst('/generations', 1, { user: randomUUID() }, 'POST')).last.status).not.toBe(429);
    const ipA = ip();
    await burst('/auth/login', 11, { ip: ipA }, 'POST');
    expect((await burst('/auth/login', 1, { ip: ip() }, 'POST')).last.status).not.toBe(429);
  }, 60_000);
});
