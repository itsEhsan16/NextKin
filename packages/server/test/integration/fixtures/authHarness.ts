import { randomUUID } from 'node:crypto';
import Valkey from 'iovalkey';
import pg from 'pg';
import { buildIdentity, type IdentityStack } from '../../../src/auth/build';
import { SESSION_COOKIE } from '../../../src/auth/sessions';
import { loadConfig } from '../../../src/config';
import { createDatabase, type Database } from '../../../src/db/database';
import { codeFrom, createMemoryEmail } from '../../../src/email/email';
import type { DependencyChecks } from '../../../src/health/checks';
import { createApi } from '../../../src/http/app';
import { buildFileDeps, buildStorage } from '../../../src/storage/build';
import type { GenerationRouteDeps } from '../../../src/http/routes/generations';
import { startFakeIssuer, type FakeIssuer } from './fakeIssuer';
import { egressHostsFor, setEgressAllowlist } from '../../../src/net/egress';
import { AI_PROVIDER_LIST } from '@nextkin/shared/models/consent';

/**
 * The real API with the real identity stack (local IdP, Valkey sessions, Postgres), plus a memory
 * mailbox and two fake OIDC issuers. Used by the auth integration suites (P4 exit). Rate limits are
 * off here: the suites sign in far more often than the auth limit allows; the limiter has its own
 * tests.
 */
export const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'correct horse battery staple';
export const DOMAIN = 'authflow.test';

const ok = async () => {};
const checks: DependencyChecks = { database: ok, valkey: ok, storage: ok, queue: ok };

export interface Harness {
  app: ReturnType<typeof createApi>;
  db: Database;
  valkey: Valkey;
  stack: IdentityStack;
  email: ReturnType<typeof createMemoryEmail>;
  google: FakeIssuer;
  apple: FakeIssuer;
  close(): Promise<void>;
}

export async function startHarness(options: { files?: boolean; generations?: Omit<GenerationRouteDeps, 'db' | 'idempotency'> | ((valkey: Valkey) => Omit<GenerationRouteDeps, 'db' | 'idempotency'>) } = {}): Promise<Harness> {
  const config = loadConfig();
  const db = createDatabase({ appUrl: config.DATABASE_URL, maintenanceUrl: config.DATABASE_MAINTENANCE_URL, readonlyUrl: config.DATABASE_READONLY_URL, poolMax: 4 });
  const valkey = new Valkey(config.VALKEY_URL);
  const email = createMemoryEmail();
  const google = await startFakeIssuer('google');
  const apple = await startFakeIssuer('apple');
  // The fake issuers listen on 127.0.0.1: the only host these suites' outbound calls may reach (P11-06).
  setEgressAllowlist([...egressHostsFor(config), '127.0.0.1']);
  const stack = buildIdentity(
    { ...config, IDENTITY_ADAPTER: 'local', API_PUBLIC_URL: ORIGIN, MOBILE_REDIRECT_ALLOWLIST: 'nextkin://' },
    db,
    valkey,
    { email, issuers: { google: google.config, apple: apple.config } },
  );
  const app = createApi({
    checks,
    db,
    config: { appEnv: 'test', appOrigin: ORIGIN, cursorSecret: config.CURSOR_SECRET },
    rateLimiter: { hit: async (_key, limit) => ({ allowed: true, limit, remaining: limit, resetSeconds: 0 }) },
    identity: stack.identity,
    generations: typeof options.generations === 'function' ? options.generations(valkey) : options.generations,
    files: options.files ? buildFileDeps(config, db) : undefined,
    documents: options.files ? { storage: buildStorage(config), exportsBucket: config.S3_BUCKET_EXPORTS } : undefined,
    // P12: the fake gateway (createApi's default) and receipts into the same memory mailbox.
    billing: { email },
  });
  return {
    app,
    db,
    valkey,
    stack,
    email,
    google,
    apple,
    async close() {
      await db.withSystem('auth suite cleanup', (tx) => tx.deleteFrom('users').where('email', 'like', `%@${DOMAIN}`).execute());
      await db.withSystem('auth suite cleanup', (tx) => tx.deleteFrom('users').where('email', 'like', '%@privaterelay.appleid.com').execute());
      const idp = new pg.Pool({ connectionString: config.DATABASE_URL, max: 1 });
      await idp.query(`delete from local_idp.accounts where email like $1 or email like '%@privaterelay.appleid.com'`, [`%@${DOMAIN}`]);
      await idp.end();
      await stack.close();
      await db.destroy();
      await valkey.quit();
      await google.close();
      await apple.close();
    },
  };
}

export const address = () => `u-${randomUUID().slice(0, 8)}@${DOMAIN}`;

/** A request helper that speaks JSON and remembers nothing; callers pass cookies and tokens. */
export function call(h: Harness, path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  return h.app.request(`/api/v1${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export function cookieFrom(res: Response): string {
  const value = res.headers.get('set-cookie')?.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`))?.[1];
  if (!value) throw new Error('no session cookie on the response');
  return `${SESSION_COOKIE}=${value}`;
}

/** Signs up and confirms through the API. */
export async function registered(h: Harness, to = address(), password = PASSWORD): Promise<string> {
  await call(h, '/auth/signup', { body: { email: to, password, name: 'Robin Route' } });
  const res = await call(h, '/auth/confirm', { body: { email: to, code: codeFrom(h.email.lastTo(to)) } });
  if (res.status !== 204) throw new Error(`confirm failed: ${res.status}`);
  return to;
}

/**
 * The suites act as users who already agreed to the AI providers (P12-12), so a signed-in test user
 * gets that consent on first login. The consent suite makes its users without it.
 */
export async function grantConsent(db: Harness['db'], email: string): Promise<void> {
  const user = await db.withSystem('test: find the user', (tx) => tx.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst());
  if (!user) return;
  await db.withUser({ userId: user.id, role: 'user' }, async (tx) => {
    const has = await tx.selectFrom('consents').select('id').where('kind', '=', 'ai_processing').where('withdrawn_at', 'is', null).executeTakeFirst();
    if (!has) await tx.insertInto('consents').values({ user_id: user.id, kind: 'ai_processing', document_version: AI_PROVIDER_LIST.version }).execute();
  });
}

export async function webLogin(h: Harness, to: string, password = PASSWORD, options: { consent?: boolean } = {}): Promise<string> {
  const res = await call(h, '/auth/login', { body: { email: to, password, client: 'web' }, headers: { origin: ORIGIN } });
  if (res.status !== 200) throw new Error(`web login failed: ${res.status} ${await res.text()}`);
  if (options.consent !== false) await grantConsent(h.db, to);
  return cookieFrom(res);
}

export async function mobileLogin(h: Harness, to: string, password = PASSWORD, options: { consent?: boolean } = {}): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await call(h, '/auth/login', { body: { email: to, password, client: 'mobile' } });
  if (res.status !== 200) throw new Error(`mobile login failed: ${res.status} ${await res.text()}`);
  if (options.consent !== false) await grantConsent(h.db, to);
  return ((await res.json()) as { tokens: { accessToken: string; refreshToken: string } }).tokens;
}

/** A cookie request; unsafe methods carry our Origin, as a browser would. */
export const withCookie = (cookie: string, unsafe = false) => ({ cookie, ...(unsafe ? { origin: ORIGIN } : {}) });
export const withBearer = (token: string) => ({ authorization: `Bearer ${token}` });
