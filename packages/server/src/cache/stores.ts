/**
 * The fast-memory stores the API needs (spec §9.11): rate-limit counters and idempotency records.
 * Valkey backs both in every environment; the in-memory versions exist for unit tests only.
 * Every operation touches a single key, so they work unchanged on ElastiCache Serverless, where a
 * multi-key operation across hash slots would fail.
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until a slot frees up. */
  resetSeconds: number;
}

export interface RateLimiter {
  hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

export interface StoredResponse {
  status: number;
  body: string;
  contentType: string;
}

export type IdempotencyBegin =
  | { state: 'new' }
  | { state: 'in_flight' }
  | { state: 'mismatch' }
  | { state: 'replay'; response: StoredResponse };

export interface IdempotencyStore {
  /** Claims the key for this request fingerprint, or reports what already holds it. */
  begin(key: string, fingerprint: string): Promise<IdempotencyBegin>;
  /** Stores the final response for 24 h (spec §9.11). */
  complete(key: string, fingerprint: string, response: StoredResponse): Promise<void>;
  /** Releases the key after a server error, so the client may retry. */
  release(key: string): Promise<void>;
}

export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;
export const IN_FLIGHT_TTL_SECONDS = 60;

/** Unit-test stores. Not used by any running process. */
export function createMemoryStores(now: () => number = Date.now): { rateLimiter: RateLimiter; idempotency: IdempotencyStore } {
  const hits = new Map<string, number[]>();
  const records = new Map<string, { fingerprint: string; response?: StoredResponse; expires: number }>();
  return {
    rateLimiter: {
      async hit(key, limit, windowSeconds) {
        const t = now();
        const windowMs = windowSeconds * 1000;
        const recent = (hits.get(key) ?? []).filter((h) => h > t - windowMs);
        if (recent.length >= limit) {
          hits.set(key, recent);
          return { allowed: false, limit, remaining: 0, resetSeconds: Math.max(1, Math.ceil((recent[0]! + windowMs - t) / 1000)) };
        }
        recent.push(t);
        hits.set(key, recent);
        return { allowed: true, limit, remaining: limit - recent.length, resetSeconds: windowSeconds };
      },
    },
    idempotency: {
      async begin(key, fingerprint) {
        const record = records.get(key);
        if (!record || record.expires < now()) {
          records.set(key, { fingerprint, expires: now() + IN_FLIGHT_TTL_SECONDS * 1000 });
          return { state: 'new' };
        }
        if (record.fingerprint !== fingerprint) return { state: 'mismatch' };
        return record.response ? { state: 'replay', response: record.response } : { state: 'in_flight' };
      },
      async complete(key, fingerprint, response) {
        records.set(key, { fingerprint, response, expires: now() + IDEMPOTENCY_TTL_SECONDS * 1000 });
      },
      async release(key) {
        records.delete(key);
      },
    },
  };
}
