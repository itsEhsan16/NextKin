import { createHash } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import type { IdempotencyStore, RateLimiter } from '../../cache/stores';
import type { Feature, Flags } from '../../flags/flags';
import type { Authenticated, ApiEnv } from '../env';
import { errors } from '../errors';
import type { OriginCheck } from '../origins';

/** Guards between the request context and the route (ImBackendImplementationPlan P3-03). */

// ---------------------------------------------------------------------------------------------
// Client compatibility (P3-07). Store builds cannot be force-updated, so a client below the floor
// gets 426 with the version it needs instead of a confusing failure later.
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

export function clientVersionFloor(flags: Flags): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const client = c.get('client');
    const version = c.get('clientVersion');
    if (client && version) {
      const minimum = await flags.minimumClientVersion(client);
      if (minimum && compareVersions(version, minimum) < 0) throw errors.upgradeRequired(minimum);
    }
    await next();
  };
}

// ---------------------------------------------------------------------------------------------
// Authentication. P4 provides the resolver (session cookie or bearer token); until then nothing
// authenticates and every protected route answers 401.
export type Authenticator = (c: Context<ApiEnv>) => Promise<Authenticated | null>;

export function authenticate(resolve: Authenticator): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    c.set('auth', await resolve(c));
    await next();
  };
}

export function requireAuth(c: Context<ApiEnv>): Authenticated {
  const auth = c.get('auth');
  if (!auth) throw errors.unauthenticated();
  return auth;
}

// ---------------------------------------------------------------------------------------------
// CSRF (P3-03). Only cookie sessions are exposed: a browser attaches the cookie to cross-site
// requests on its own. A bearer token is never sent automatically, so bearer requests skip this.
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function csrf(trusted: OriginCheck): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    if (UNSAFE.has(c.req.method) && c.get('auth')?.via === 'cookie') {
      const origin = c.req.header('origin');
      const site = c.req.header('sec-fetch-site');
      const sameOrigin = origin ? trusted(origin) : site === 'same-origin';
      if (!sameOrigin) throw errors.forbidden();
      const type = c.req.header('content-type') ?? '';
      // A bodyless POST (logout) or DELETE has nothing to smuggle; Origin above already covers it.
      // Next hands a route an empty stream even then, so a body is one the request declares: a
      // content type (every cross-site form sends one), a length above zero, or chunked transfer
      // (toreview §124: browser deletes were refused).
      const length = c.req.header('content-length');
      const declared = type !== '' || (length !== undefined && length !== '0') || c.req.header('transfer-encoding') !== undefined;
      const hasBody = c.req.raw.body !== null && declared;
      if (hasBody && !type.toLowerCase().startsWith('application/json')) {
        throw errors.validation({ contentType: 'application/json required' }, 'Send the request body as JSON.');
      }
    }
    await next();
  };
}

// ---------------------------------------------------------------------------------------------
// Rate limits (P3-03, spec §9.11). Per route class and per subject: the user when signed in, the
// client IP otherwise. Tier-aware limits arrive with entitlements (P12). If Valkey is unreachable
// the request is let through and logged: quotas still protect the expensive paths, and a cache
// outage must not take the product down (R-09).
export interface RouteClass {
  name: string;
  limit: number;
  windowSeconds: number;
}

const CLASSES: {
  prefix: string;
  writesOnly?: boolean;
  anonymous: RouteClass;
  user: RouteClass;
}[] = [
  {
    prefix: '/api/v1/auth',
    anonymous: { name: 'auth', limit: 10, windowSeconds: 60 },
    user: { name: 'auth', limit: 20, windowSeconds: 60 },
  },
  // Starting, retrying or cancelling a run spends model calls; reading one (its status, its result,
  // the list) does not, and a run's progress screen polls it every second. Reads take the default
  // bucket, or a run longer than 20 seconds sat finished behind a 429 (toreview §110.3).
  {
    prefix: '/api/v1/generations',
    writesOnly: true,
    anonymous: { name: 'ai', limit: 5, windowSeconds: 60 },
    user: { name: 'ai', limit: 20, windowSeconds: 60 },
  },
  // Its own bucket: §9.11 keys counters per route, so chatting never spends the generation allowance.
  {
    prefix: '/api/v1/assistant',
    anonymous: { name: 'assistant', limit: 5, windowSeconds: 60 },
    user: { name: 'assistant', limit: 30, windowSeconds: 60 },
  },
  // "Add the result" drafts (toreview §129): a fast-tier call per bullet the user opens.
  {
    prefix: '/api/v1/tailor/figure-draft',
    anonymous: { name: 'figure', limit: 5, windowSeconds: 60 },
    user: { name: 'figure', limit: 40, windowSeconds: 60 },
  },
  // "Did you use this here?" (toreview §206.3): one fast-tier call as the comparison opens, cached
  // for the same resume and job. Its own bucket, so opening the page never spends another allowance.
  {
    prefix: '/api/v1/tailor/keyword-questions',
    anonymous: { name: 'keyword-questions', limit: 5, windowSeconds: 60 },
    user: { name: 'keyword-questions', limit: 20, windowSeconds: 60 },
  },
  // Reporting a shared link (toreview §171.13): anyone holding a link may, so the bucket is small.
  // Reading the link itself is a GET and keeps the default bucket.
  {
    prefix: '/api/v1/public/shared-reports',
    writesOnly: true,
    anonymous: { name: 'abuse-report', limit: 5, windowSeconds: 600 },
    user: { name: 'abuse-report', limit: 10, windowSeconds: 600 },
  },
  {
    prefix: '/api/v1/uploads',
    anonymous: { name: 'upload', limit: 5, windowSeconds: 60 },
    user: { name: 'upload', limit: 30, windowSeconds: 60 },
  },
];
const DEFAULT_CLASS = {
  anonymous: { name: 'default', limit: 60, windowSeconds: 60 },
  user: { name: 'default', limit: 300, windowSeconds: 60 },
};

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function classify(path: string, signedIn: boolean, method = 'GET'): RouteClass {
  const read = READS.has(method.toUpperCase());
  const match = CLASSES.find((entry) => path.startsWith(entry.prefix) && !(entry.writesOnly && read)) ?? DEFAULT_CLASS;
  return signedIn ? match.user : match.anonymous;
}

export function rateLimit(limiter: RateLimiter): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    if (c.req.path.startsWith('/api/v1/health')) return next();
    const auth = c.get('auth');
    const routeClass = classify(c.req.path, Boolean(auth), c.req.method);
    const subject = auth ? `user:${auth.identity.userId}` : `ip:${c.get('clientIp')}`;
    let result;
    try {
      result = await limiter.hit(`rl:any:${routeClass.name}:${subject}`, routeClass.limit, routeClass.windowSeconds);
    } catch (error) {
      c.get('log').warn({ event: 'ratelimit.unavailable', errorName: (error as Error).name }, 'rate limiter unavailable; allowing');
      return next();
    }
    if (!result.allowed) throw errors.rateLimited(result.resetSeconds);
    await next();
    c.res.headers.set('RateLimit-Limit', String(result.limit));
    c.res.headers.set('RateLimit-Remaining', String(result.remaining));
    c.res.headers.set('RateLimit-Reset', String(result.resetSeconds));
  };
}

// ---------------------------------------------------------------------------------------------
// Idempotency (P3-03, R-06). On every create a client may retry. The same key with the same body
// replays the stored response; with a different body it is 422; while the first is still running
// it is 409. A 5xx releases the key so the client can retry. Keys live 24 h (spec §9.11).
const KEY = /^[A-Za-z0-9._:-]{8,200}$/;

export function idempotent(store: IdempotencyStore, options: { required: boolean }): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const key = c.req.header('idempotency-key');
    if (!key) {
      if (options.required) throw errors.validation({ 'Idempotency-Key': 'required' }, 'Send an Idempotency-Key header.');
      return next();
    }
    if (!KEY.test(key)) throw errors.validation({ 'Idempotency-Key': 'invalid' }, 'The Idempotency-Key is not valid.');
    const auth = c.get('auth');
    const scope = `idem:${auth?.identity.userId ?? 'anonymous'}:${key}`;
    const fingerprint = createHash('sha256')
      .update(`${c.req.method} ${c.req.path}\n${await c.req.text()}`)
      .digest('hex');

    const begun = await store.begin(scope, fingerprint);
    if (begun.state === 'mismatch') throw errors.idempotencyMismatch();
    if (begun.state === 'in_flight') throw errors.conflict('A request with this Idempotency-Key is still in progress.');
    if (begun.state === 'replay') {
      return new Response(begun.response.body, {
        status: begun.response.status,
        headers: {
          'Content-Type': begun.response.contentType,
          'Idempotent-Replayed': 'true',
        },
      });
    }

    await next();
    if (c.res.status >= 500) {
      await store.release(scope);
      return;
    }
    const body = await c.res.clone().text();
    await store.complete(scope, fingerprint, {
      status: c.res.status,
      body,
      contentType: c.res.headers.get('content-type') ?? 'application/json',
    });
  };
}

// ---------------------------------------------------------------------------------------------
// Kill switches (P3-11). A feature switched off answers 503 with its degraded message, no deploy.
export function feature(flags: Flags, name: Feature, message: string): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    if (!(await flags.isEnabled(name))) throw errors.unavailable(message);
    await next();
  };
}
