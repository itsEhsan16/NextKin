import Valkey from 'iovalkey';

import { loadConfig } from '../config';

/**
 * Next's incremental (ISR) cache on Valkey (ImBackendImplementationPlan P11-07, M0-15; spec §9.6).
 * Next keeps that cache on each task's disk and memory by default, so two web tasks would serve two
 * different versions of a page. Here every task reads and writes one shared cache, and a tag
 * revalidated on one task is stale on all of them.
 *
 * - An entry is stored with its tags; `revalidateTag` records when each tag was revalidated, and
 *   an entry older than any of its tags' revalidation reads as a miss.
 * - Values hold Buffers and Maps (an app page's RSC payload and segments), so they are encoded
 *   explicitly rather than trusting JSON to round-trip them.
 * - Entries expire after a week unread, so a page no one asks for leaves the cache on its own.
 *
 * `ValkeyIncrementalCache` takes its client (tests use it directly); `NextCacheHandler` is the class
 * Next instantiates, sharing one connection per process built from `loadConfig()`. Mounting it in
 * `next.config` waits for the first ISR page (toreview §105.18).
 */

const ENTRY_TTL_SECONDS = 7 * 24 * 3600;
const TAG_TTL_SECONDS = 30 * 24 * 3600;

export interface CacheEntry {
  lastModified: number;
  value: unknown;
}

type Tagged = { tags?: string[]; softTags?: string[] };

function encode(value: unknown): string {
  return JSON.stringify(value, function (this: Record<string, unknown>, key: string, encoded: unknown) {
    const raw = this[key];
    if (Buffer.isBuffer(raw)) return { __nk: 'buf', v: raw.toString('base64') };
    if (raw instanceof Map) return { __nk: 'map', v: [...raw.entries()] };
    return encoded;
  });
}

function decode(text: string): unknown {
  return JSON.parse(text, (_key, value: unknown) => {
    if (value && typeof value === 'object' && '__nk' in value) {
      const tagged = value as { __nk: string; v: unknown };
      if (tagged.__nk === 'buf') return Buffer.from(tagged.v as string, 'base64');
      if (tagged.__nk === 'map') return new Map(tagged.v as [unknown, unknown][]);
    }
    return value;
  });
}

/** The tags an entry answers to: the ones Next passed on set, plus a page's own cache-tags header. */
function tagsOf(value: unknown, ctx: Tagged | undefined): string[] {
  const header = (value as { headers?: Record<string, unknown> } | null)?.headers?.['x-next-cache-tags'];
  const fromHeader = typeof header === 'string' ? header.split(',') : [];
  return [...new Set([...(ctx?.tags ?? []), ...(ctx?.softTags ?? []), ...fromHeader].map((t) => t.trim()).filter(Boolean))];
}

export class ValkeyIncrementalCache {
  constructor(
    private readonly valkey: Pick<Valkey, 'get' | 'set' | 'mget'>,
    private readonly prefix = 'isr:',
  ) {}

  async get(key: string, ctx?: Tagged): Promise<CacheEntry | null> {
    const raw = await this.valkey.get(`${this.prefix}e:${key}`);
    if (!raw) return null;
    const stored = decode(raw) as CacheEntry & { tags: string[] };
    const tags = [...new Set([...stored.tags, ...(ctx?.softTags ?? [])])];
    if (tags.length) {
      const revalidated = await this.valkey.mget(...tags.map((t) => `${this.prefix}t:${t}`));
      if (revalidated.some((at) => at !== null && Number(at) > stored.lastModified)) return null;
    }
    return { lastModified: stored.lastModified, value: stored.value };
  }

  async set(key: string, value: unknown, ctx?: Tagged): Promise<void> {
    if (value === null || value === undefined) return;
    const entry = { lastModified: Date.now(), value, tags: tagsOf(value, ctx) };
    await this.valkey.set(`${this.prefix}e:${key}`, encode(entry), 'EX', ENTRY_TTL_SECONDS);
  }

  async revalidateTag(tags: string | string[]): Promise<void> {
    const now = String(Date.now());
    for (const tag of Array.isArray(tags) ? tags : [tags]) await this.valkey.set(`${this.prefix}t:${tag}`, now, 'EX', TAG_TTL_SECONDS);
  }

  resetRequestCache(): void {}
}

let shared: Valkey | undefined;
const connection = () => (shared ??= new Valkey(loadConfig().VALKEY_URL, { maxRetriesPerRequest: 1 }));

/** The class `next.config`'s `cacheHandler` names: one Valkey connection per process. */
export default class NextCacheHandler extends ValkeyIncrementalCache {
  constructor() {
    super(connection());
  }
}
