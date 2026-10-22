import type { Database } from '../db/database';

/**
 * Feature flags and kill switches from app.app_settings (ImBackendImplementationPlan P3-11,
 * R-09). Switching a feature off is a settings change, not a deploy; the route answers with its
 * named degraded response. Values are cached in-process for a few seconds so a flag read never
 * costs a database round trip per request; `invalidate()` is the hook P12's admin writes call.
 */
export type Feature = 'assistant' | 'teaser' | 'job_search';

export interface Flags {
  get(key: string): Promise<unknown>;
  isEnabled(feature: Feature): Promise<boolean>;
  /** Minimum supported client version per platform (P3-07), or null when unset. */
  minimumClientVersion(client: string): Promise<string | null>;
  invalidate(): void;
}

const CACHE_MS = 10_000;

export function createFlags(db: Database, now: () => number = Date.now): Flags {
  let cache: { at: number; values: Map<string, unknown> } | null = null;

  async function load(): Promise<Map<string, unknown>> {
    if (cache && now() - cache.at < CACHE_MS) return cache.values;
    const rows = await db.withAnonymous((tx) => tx.selectFrom('app_settings').select(['key', 'value']).execute());
    cache = { at: now(), values: new Map(rows.map((r) => [r.key, r.value])) };
    return cache.values;
  }

  return {
    async get(key) {
      return (await load()).get(key);
    },
    async isEnabled(feature) {
      // A missing flag means enabled: kill switches turn things off, they are not required to run.
      return (await load()).get(`features.${feature}.enabled`) !== false;
    },
    async minimumClientVersion(client) {
      const floors = (await load()).get('clients.minimum_version');
      if (!floors || typeof floors !== 'object') return null;
      const value = (floors as Record<string, unknown>)[client];
      return typeof value === 'string' ? value : null;
    },
    invalidate() {
      cache = null;
    },
  };
}

/** For unit tests and for processes without a database. */
export function createStaticFlags(values: Record<string, unknown> = {}): Flags {
  const map = new Map(Object.entries(values));
  return {
    async get(key) {
      return map.get(key);
    },
    async isEnabled(feature) {
      return map.get(`features.${feature}.enabled`) !== false;
    },
    async minimumClientVersion(client) {
      const floors = map.get('clients.minimum_version') as Record<string, string> | undefined;
      return floors?.[client] ?? null;
    },
    invalidate() {},
  };
}
