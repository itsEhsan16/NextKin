import { z } from 'zod';
import type { Database } from '../db/database';
import type { LlmUsage } from './types';

/**
 * Routing and prices (ImBackendImplementationPlan P6-07, P6-10). Both live in `app_settings`, so
 * changing a stage's model, its order of providers or a price is a settings change with no deploy.
 * **Model ids live only there** — never in code. The seed writes them from
 * doc/decisions/appendix-c/pinned-versions.md.
 *
 * A route names a provider *family*. `claude` is resolved by LLM_ROUTE (fake, recorded,
 * claudeDirect, claudeAws); `bedrock` and `openai` are the failover families (X-10), skipped until
 * their adapters exist.
 */

export const routeStepSchema = z.object({
  provider: z.enum(['claude', 'bedrock', 'openai']),
  model: z.string().min(1).max(120),
  maxTokens: z.number().int().min(1).max(64_000),
  /** The most the stage may send, in tokens; inputs over it are cut deterministically. */
  inputBudgetTokens: z.number().int().min(100).max(200_000),
  temperature: z.number().min(0).max(1).optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
  geography: z.enum(['us', 'eu', 'global']).optional(),
});
export type RouteStep = z.infer<typeof routeStepSchema>;

export const routingSchema = z.object({
  /** The seed's revision of this setting: a re-seed replaces an older one (P9), never a newer one. */
  version: z.number().int().min(1),
  /** stage name → providers to try, in order. `default` covers a stage with no entry. */
  stages: z.record(z.string(), z.array(routeStepSchema).min(1)),
});
export type Routing = z.infer<typeof routingSchema>;

const priceSchema = z.object({
  inputPerMTok: z.number().min(0),
  outputPerMTok: z.number().min(0),
  cacheReadPerMTok: z.number().min(0),
  cacheWritePerMTok: z.number().min(0),
});
export const pricesSchema = z.object({ version: z.number().int().min(1), models: z.record(z.string(), priceSchema) });
export type Prices = z.infer<typeof pricesSchema>;

export const ROUTING_KEY = 'ai.routing';
export const PRICES_KEY = 'ai.prices';

/** US dollars per million tokens is exactly micro-dollars per token. */
export function costMicros(prices: Prices, model: string, usage: LlmUsage): number {
  const p = prices.models[model];
  if (!p) return 0;
  return Math.round(
    usage.inputTokens * p.inputPerMTok + usage.outputTokens * p.outputPerMTok + usage.cacheReadTokens * p.cacheReadPerMTok + usage.cacheWriteTokens * p.cacheWritePerMTok,
  );
}

export interface AiSettings {
  routeFor(stage: string): Promise<RouteStep[]>;
  prices(): Promise<Prices>;
}

/** Reads both settings, cached for `ttlMs` so a change lands within that window everywhere. */
export function createAiSettings(db: Database, ttlMs = 30_000): AiSettings {
  let cached: { at: number; routing: Routing; prices: Prices } | null = null;
  async function load() {
    if (cached && Date.now() - cached.at < ttlMs) return cached;
    const rows = await db.withSystem('ai: read routing and prices', (tx) =>
      tx.selectFrom('app_settings').select(['key', 'value']).where('key', 'in', [ROUTING_KEY, PRICES_KEY]).execute(),
    );
    const value = (key: string) => rows.find((row) => row.key === key)?.value;
    const routing = routingSchema.safeParse(value(ROUTING_KEY));
    const prices = pricesSchema.safeParse(value(PRICES_KEY));
    if (!routing.success) throw new Error(`app_settings ${ROUTING_KEY} is missing or invalid; run pnpm seed`);
    cached = { at: Date.now(), routing: routing.data, prices: prices.success ? prices.data : { version: 1, models: {} } };
    return cached;
  }
  return {
    async routeFor(stage) {
      const { routing } = await load();
      return routing.stages[stage] ?? routing.stages.default ?? [];
    },
    async prices() {
      return (await load()).prices;
    },
  };
}
