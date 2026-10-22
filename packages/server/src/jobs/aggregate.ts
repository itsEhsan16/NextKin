import type { DegradedSignal } from '../health/degraded';
import { createHash } from 'node:crypto';

import { sql } from 'kysely';

import type { KvCache } from '../cache/kv';
import type { Database } from '../db/database';
import type { Logger } from '../observability/logger';
import type { Breaker } from './breaker';
import { jobIdOf } from './ids';
import type { ProviderRegistry } from './registry';
import { normalizedJobSchema, type JobProvider, type NormalizedJob, type ProviderName, type ProviderQuery } from './types';

/**
 * Aggregation (ImBackendImplementationPlan P11-02; V2 §7.13, §9.6, §9.11). One search fans out to
 * the enabled providers in priority order, each behind its circuit breaker and daily quota.
 * Listings are validated, deduplicated (same canonical apply URL, then a fuzzy title, company and
 * city match with pg_trgm, keeping the richer listing), and upserted into `jobs_cache` as
 * normalized metadata only. The merged order is kept in Valkey under `jobs:<hash>`, and a miss is
 * single-flight, in process and across processes, so a cold query never stampedes the providers.
 * A provider that fails or is switched off simply drops out: the others' results still come back.
 */

export interface CachedListing {
  jobId: string;
  cacheId: string;
  normalized: NormalizedJob;
  /** Its position in the merged result: the relevance order. */
  rank: number;
}

export interface MergedListings {
  listings: CachedListing[];
  degraded: ProviderName[];
  fromCache: boolean;
}

export interface AggregateDeps {
  db: Database;
  kv: KvCache;
  registry: ProviderRegistry;
  breaker: Breaker;
  log: Logger;
  /** Each provider's call is abandoned after this long (default 8 s). */
  timeoutMs?: number;
  /** R-09: a fan-out with a provider down marks `jobs` degraded; a clean one clears it. */
  signal?: DegradedSignal;
}

interface CachedResult {
  ids: string[];
  fetchedAt: string;
  degraded: ProviderName[];
}

const RICHNESS: Record<NormalizedJob['descriptionKind'], number> = { full: 3, snippet: 2, title_only: 1 };
const inflight = new Map<string, Promise<MergedListings>>();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What a provider is asked: only the filters it can apply itself; the rest are applied in memory. */
const askedOf = (provider: JobProvider, query: ProviderQuery): ProviderQuery => ({
  page: query.page,
  ...(provider.capabilities.filters.includes('query') && query.query ? { query: query.query.trim().toLowerCase() } : {}),
  ...(provider.capabilities.filters.includes('location') && query.location ? { location: query.location.trim().toLowerCase() } : {}),
});

async function loadListings(db: Database, ids: string[]): Promise<CachedListing[]> {
  if (ids.length === 0) return [];
  const rows = await db.withAnonymous((tx) =>
    tx
      .selectFrom('jobs_cache')
      .select(['id', 'normalized', sql<string>`app.job_id_of(apply_url_hash)`.as('job_id')])
      .where((eb) => eb(sql`app.job_id_of(apply_url_hash)`, 'in', ids))
      .where('expires_at', '>', new Date())
      .execute(),
  );
  const byId = new Map(rows.map((r) => [r.job_id, r]));
  return ids.flatMap((id, rank) => {
    const row = byId.get(id);
    const parsed = row ? normalizedJobSchema.safeParse(row.normalized) : null;
    return row && parsed?.success ? [{ jobId: id, cacheId: row.id, normalized: parsed.data, rank }] : [];
  });
}

async function callProvider(deps: AggregateDeps, entry: { provider: JobProvider; setting: { dailyCalls?: number } }, query: ProviderQuery): Promise<NormalizedJob[] | null> {
  const { provider } = entry;
  if (!(await deps.breaker.allow(provider.name))) return null;
  if (!(await deps.breaker.spend(provider.name, entry.setting.dailyCalls))) {
    deps.log.warn({ event: 'jobs.quota_spent', provider: provider.name }, 'job provider daily quota spent');
    return null;
  }
  const timeoutMs = deps.timeoutMs ?? 8_000;
  try {
    const result = await Promise.race([
      provider.search(askedOf(provider, query), AbortSignal.timeout(timeoutMs)),
      sleep(timeoutMs).then(() => Promise.reject(new Error(`${provider.name} timed out`))),
    ]);
    await deps.breaker.success(provider.name);
    return result;
  } catch (error) {
    await deps.breaker.failure(provider.name);
    deps.log.warn({ event: 'jobs.provider_failed', provider: provider.name, errorName: error instanceof Error ? error.name : typeof error }, 'job provider failed');
    return null;
  }
}

/** Keeps the richer of two listings: fuller description, then the employer's own link, then priority. */
function richer(a: NormalizedJob, b: NormalizedJob, priority: Map<ProviderName, number>, direct: Set<ProviderName>): NormalizedJob {
  const score = (n: NormalizedJob) => RICHNESS[n.descriptionKind] * 10 + (direct.has(n.provider) ? 1 : 0);
  if (score(a) !== score(b)) return score(a) > score(b) ? a : b;
  return (priority.get(a.provider) ?? 999) <= (priority.get(b.provider) ?? 999) ? a : b;
}

async function fetchAndMerge(deps: AggregateDeps, key: string, query: ProviderQuery): Promise<MergedListings> {
  const { providers } = await deps.registry.active();
  const priority = new Map(providers.map((p, i) => [p.provider.name, i]));
  const direct = new Set(providers.filter((p) => p.provider.capabilities.directApply).map((p) => p.provider.name));
  const answers = await Promise.all(providers.map((entry) => callProvider(deps, entry, query)));
  const degraded = providers.filter((_, i) => answers[i] === null).map((p) => p.provider.name);

  // Validate, then dedupe on the canonical apply-URL hash.
  const byHash = new Map<string, NormalizedJob>();
  answers.forEach((list, i) => {
    for (const raw of list ?? []) {
      const parsed = normalizedJobSchema.safeParse(raw);
      if (!parsed.success) {
        deps.log.warn({ event: 'jobs.listing_invalid', provider: providers[i]!.provider.name }, 'a provider listing failed validation and was dropped');
        continue;
      }
      const seen = byHash.get(parsed.data.applyUrlHash);
      byHash.set(parsed.data.applyUrlHash, seen ? richer(seen, parsed.data, priority, direct) : parsed.data);
    }
  });
  let listings = [...byHash.values()];

  if (listings.length > 0) {
    const ttlHours = Math.min(72, ...providers.map((p) => p.provider.ttlHours));
    const fetchedAt = new Date();
    const expiresAt = new Date(fetchedAt.getTime() + ttlHours * 3_600_000);
    // A provider that renamed a listing's URL keeps its old row (and its id) rather than colliding.
    const taken = await deps.db.withAnonymous((tx) =>
      tx.selectFrom('jobs_cache').select(['provider', 'provider_job_id', 'apply_url_hash']).where('provider_job_id', 'in', listings.map((l) => l.providerJobId)).execute(),
    );
    listings = listings.filter((l) => !taken.some((t) => t.provider === l.provider && t.provider_job_id === l.providerJobId && t.apply_url_hash !== l.applyUrlHash));
    await deps.db.withAnonymous((tx) =>
      tx
        .insertInto('jobs_cache')
        .values(
          listings.map((l) => ({
            apply_url_hash: l.applyUrlHash,
            provider: l.provider,
            provider_job_id: l.providerJobId,
            title: l.title.slice(0, 300),
            company: l.company.slice(0, 200),
            location: l.location.slice(0, 200),
            country: l.country,
            normalized: JSON.stringify(l),
            description_kind: l.descriptionKind,
            fetched_at: fetchedAt,
            expires_at: expiresAt,
          })),
        )
        .onConflict((oc) =>
          oc.column('apply_url_hash').doUpdateSet((eb) => ({
            normalized: eb.ref('excluded.normalized'),
            title: eb.ref('excluded.title'),
            company: eb.ref('excluded.company'),
            location: eb.ref('excluded.location'),
            description_kind: eb.ref('excluded.description_kind'),
            fetched_at: eb.ref('excluded.fetched_at'),
            expires_at: eb.ref('excluded.expires_at'),
          })),
        )
        .execute(),
    );

    // The same job listed by two providers under two URLs: a fuzzy title, company and city match.
    const hashes = listings.map((l) => l.applyUrlHash);
    const pairs = await deps.db.withAnonymous((tx) =>
      sql<{ a: string; b: string }>`
        SELECT a.apply_url_hash AS a, b.apply_url_hash AS b
        FROM app.jobs_cache a JOIN app.jobs_cache b ON a.apply_url_hash < b.apply_url_hash
        WHERE a.apply_url_hash = ANY(${hashes}) AND b.apply_url_hash = ANY(${hashes}) AND a.provider <> b.provider
          AND similarity(lower(a.title || ' ' || a.company), lower(b.title || ' ' || b.company)) >= 0.75
          AND similarity(lower(coalesce(a.location, '')), lower(coalesce(b.location, ''))) >= 0.5
      `.execute(tx),
    );
    const dropped = new Set<string>();
    const byKey = new Map(listings.map((l) => [l.applyUrlHash, l]));
    for (const { a, b } of pairs.rows) {
      const la = byKey.get(a);
      const lb = byKey.get(b);
      if (!la || !lb || dropped.has(a) || dropped.has(b)) continue;
      dropped.add(richer(la, lb, priority, direct) === la ? b : a);
    }
    listings = listings.filter((l) => !dropped.has(l.applyUrlHash));
  }

  // Relevance: each provider's best first, interleaved by rank, providers in priority order.
  listings.sort((x, y) => x.rank - y.rank || (priority.get(x.provider) ?? 999) - (priority.get(y.provider) ?? 999));
  const ids = listings.map((l) => jobIdOf(l.applyUrlHash));
  const ttlSeconds = degraded.length > 0 ? 300 : Math.max(3600, Math.min(72, ...providers.map((p) => p.provider.ttlHours)) * 3600);
  await deps.kv.set(key, { ids, fetchedAt: new Date().toISOString(), degraded } satisfies CachedResult, ttlSeconds).catch(() => undefined);
  if (deps.signal) void (degraded.length > 0 ? deps.signal.mark('jobs') : deps.signal.clear('jobs'));
  return { listings: await loadListings(deps.db, ids), degraded, fromCache: false };
}

/** The merged, deduplicated listings for a query, from Valkey when fresh, else from the providers. */
export async function mergedListings(deps: AggregateDeps, query: ProviderQuery): Promise<MergedListings> {
  const { providers, version } = await deps.registry.active();
  const asked = providers.map((p) => askedOf(p.provider, query));
  const key = `jobs:${createHash('sha256').update(JSON.stringify([version, asked])).digest('hex').slice(0, 24)}`;

  const cached = await deps.kv.get<CachedResult>(key).catch(() => null);
  if (cached) {
    const listings = await loadListings(deps.db, cached.ids);
    // A purged or expired row means the result is stale: refetch rather than show a thin list.
    if (listings.length === cached.ids.length) return { listings, degraded: cached.degraded, fromCache: true };
  }

  const running = inflight.get(key);
  if (running) return running;
  const flight = (async () => {
    const lockKey = `lock:${key}`;
    const locked = await deps.kv.setNX(lockKey, 1, 15).catch(() => true);
    if (!locked) {
      // Another task is fetching this query: wait briefly for its result before fetching ourselves.
      for (let i = 0; i < 10; i++) {
        await sleep(200);
        const hit = await deps.kv.get<CachedResult>(key).catch(() => null);
        if (hit) return { listings: await loadListings(deps.db, hit.ids), degraded: hit.degraded, fromCache: true };
      }
    }
    try {
      return await fetchAndMerge(deps, key, query);
    } finally {
      if (locked) await deps.kv.del(lockKey).catch(() => undefined);
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, flight);
  return flight;
}
