import { randomUUID } from 'node:crypto';
import type Valkey from 'iovalkey';
import {
  IDEMPOTENCY_TTL_SECONDS,
  IN_FLIGHT_TTL_SECONDS,
  type IdempotencyStore,
  type RateLimiter,
  type StoredResponse,
} from './stores';

/**
 * Valkey-backed stores (spec §9.11). Key names follow the spec: `rl:<tier>:<route>:<subject>` and
 * `idem:<user_id>:<key>`. Each operation is one key and one round trip (a Lua script where it
 * needs to be atomic), so it is safe under concurrency and on clustered ElastiCache.
 */

// Sliding-window log: drop entries older than the window, count, admit if under the limit.
const SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  return {0, count, tonumber(oldest[2]) + window - now}
end
redis.call('ZADD', key, now, ARGV[4])
redis.call('PEXPIRE', key, window)
return {1, count + 1, window}
`;

export function createValkeyRateLimiter(valkey: Valkey): RateLimiter {
  return {
    async hit(key, limit, windowSeconds) {
      const windowMs = windowSeconds * 1000;
      const [allowed, count, resetMs] = (await valkey.eval(SLIDING_WINDOW, 1, key, Date.now(), windowMs, limit, randomUUID())) as [
        number,
        number,
        number,
      ];
      return {
        allowed: allowed === 1,
        limit,
        remaining: Math.max(0, limit - count),
        resetSeconds: Math.max(1, Math.ceil(resetMs / 1000)),
      };
    },
  };
}

interface Record {
  f: string;
  r?: StoredResponse;
}

export function createValkeyIdempotencyStore(valkey: Valkey): IdempotencyStore {
  return {
    async begin(key, fingerprint) {
      const claimed = await valkey.set(key, JSON.stringify({ f: fingerprint } satisfies Record), 'EX', IN_FLIGHT_TTL_SECONDS, 'NX');
      if (claimed === 'OK') return { state: 'new' };
      const raw = await valkey.get(key);
      if (!raw) {
        // Expired between the two calls: claim again rather than guess.
        const retry = await valkey.set(key, JSON.stringify({ f: fingerprint } satisfies Record), 'EX', IN_FLIGHT_TTL_SECONDS, 'NX');
        return retry === 'OK' ? { state: 'new' } : { state: 'in_flight' };
      }
      const record = JSON.parse(raw) as Record;
      if (record.f !== fingerprint) return { state: 'mismatch' };
      return record.r ? { state: 'replay', response: record.r } : { state: 'in_flight' };
    },
    async complete(key, fingerprint, response) {
      await valkey.set(key, JSON.stringify({ f: fingerprint, r: response } satisfies Record), 'EX', IDEMPOTENCY_TTL_SECONDS);
    },
    async release(key) {
      await valkey.del(key);
    },
  };
}
