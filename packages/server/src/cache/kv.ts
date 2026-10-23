import type Valkey from 'iovalkey';

/**
 * A small key–value cache with expiry (spec §9.11): the 30-day JD extraction cache (`jd:<hash>`,
 * P9-01), job search results (`jobs:<hash>`), provider circuit breakers (`cb:<provider>`) and
 * their quota counters (P11-02). Valkey in every environment; an in-memory one for unit tests.
 * Values are JSON. Every operation is single-key, so it is safe on a sharded (cluster) Valkey.
 */
export interface KvCache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  /** Sets only when absent; true when this call set it (a lock, a single-flight claim). */
  setNX(key: string, value: unknown, ttlSeconds: number): Promise<boolean>;
  del(key: string): Promise<void>;
  /** Increments a counter, giving a new one `ttlSeconds` to live; returns the new count. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

export function createValkeyKv(valkey: Valkey): KvCache {
  return {
    async get<T>(key: string) {
      const raw = await valkey.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    },
    async set(key, value, ttlSeconds) {
      await valkey.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    },
    async setNX(key, value, ttlSeconds) {
      return (await valkey.set(key, JSON.stringify(value), 'EX', ttlSeconds, 'NX')) === 'OK';
    },
    async del(key) {
      await valkey.del(key);
    },
    async incr(key, ttlSeconds) {
      const count = await valkey.incr(key);
      if (count === 1) await valkey.expire(key, ttlSeconds);
      return count;
    },
  };
}

export function createMemoryKv(now: () => number = Date.now): KvCache {
  const store = new Map<string, { value: string; expiresAt: number }>();
  const live = (key: string) => {
    const hit = store.get(key);
    if (!hit || hit.expiresAt <= now()) {
      store.delete(key);
      return null;
    }
    return hit;
  };
  return {
    async get<T>(key: string) {
      const hit = live(key);
      return hit ? (JSON.parse(hit.value) as T) : null;
    },
    async set(key, value, ttlSeconds) {
      store.set(key, { value: JSON.stringify(value), expiresAt: now() + ttlSeconds * 1000 });
    },
    async setNX(key, value, ttlSeconds) {
      if (live(key)) return false;
      store.set(key, { value: JSON.stringify(value), expiresAt: now() + ttlSeconds * 1000 });
      return true;
    },
    async del(key) {
      store.delete(key);
    },
    async incr(key, ttlSeconds) {
      const hit = live(key);
      const count = (hit ? Number(JSON.parse(hit.value)) : 0) + 1;
      store.set(key, { value: JSON.stringify(count), expiresAt: hit?.expiresAt ?? now() + ttlSeconds * 1000 });
      return count;
    },
  };
}
